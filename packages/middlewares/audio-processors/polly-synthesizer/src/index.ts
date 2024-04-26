/*
 * Copyright (C) 2023 Amazon.com, Inc. or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CacheStorage } from '@project-lakechain/core';
import { PollySynthesizerProps, PollySynthesizerSchema } from './definitions/opts';
import { PollyLanguage } from './definitions/language';
import { VoiceDescriptor } from './definitions/voice-descriptor';
import { map } from './definitions/voices';

import {
  Middleware,
  MiddlewareBuilder,
  NAMESPACE,
  LAMBDA_INSIGHTS_VERSION
} from '@project-lakechain/core/middleware';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'polly-synthesizer',
  description: 'Synthesizes text into speech using Amazon Polly.',
  version: '0.7.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.minutes(1);

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME = lambda.Runtime.NODEJS_18_X;

/**
 * The default maximum concurrency for the compute.
 */
const DEFAULT_MAX_CONCURRENCY = 2;

/**
 * Builder for the `PollySynthesizer` middleware.
 */
class PollySynthesizerBuilder extends MiddlewareBuilder {
  private providerProps: Partial<PollySynthesizerProps> = {};

  /**
   * Builder constructor.
   */
  constructor() {
    super();
    this.providerProps.voiceMapping = {};
  }

  /**
   * Specifies the language to assume the source
   * document being written in.
   * @see https://docs.aws.amazon.com/polly/latest/dg/SupportedLanguage.html
   * @param language the language to assume.
   * @returns the builder itself.
   */
  public withLanguageOverride(language: PollyLanguage) {
    this.providerProps.languageOverride = language;
    return (this);
  }

  /**
   * Specifies a mapping between a language and a voice descriptor.
   * @param language the language to map.
   * @param voice the voice descriptor to map.
   * @see https://docs.aws.amazon.com/polly/latest/dg/voicelist.html
   * @returns the builder itself.
   */
  public withVoiceMapping(language: PollyLanguage, ...voiceArray: VoiceDescriptor[]) {
    const languageVoices = this.providerProps.voiceMapping![language];

    // Verify that the voices match the given language.
    const incompatibleVoices = voiceArray.filter(voice =>
      !map
        .filter(voice => voice['ISO-639-1'] === language)
        .find(v => v.Id === voice.voice)
    );

    // Throw an error if there are incompatible voices.
    if (incompatibleVoices.length > 0) {
      throw new Error(
        `The following voices are not available for the language ${language}: ` +
        `${incompatibleVoices.map(v => v.voice).join(', ')}`
      );
    }

    if (languageVoices) {
      this.providerProps.voiceMapping![language] = [
        ...languageVoices,
        ...voiceArray
      ];
      return (this);
    }
    this.providerProps.voiceMapping![language] = voiceArray;
    return (this);
  }

  /**
   * @returns a new instance of the `PollySynthesizer`
   * service constructed with the given parameters.
   */
  public build(): PollySynthesizer {
    return (new PollySynthesizer(
      this.scope,
      this.identifier, {
        ...this.providerProps as PollySynthesizerProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware allowing to extract metadata from images
 * using the managed Amazon Rekognition service.
 */
export class PollySynthesizer extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The event handler lambda function.
   */
  public eventHandler: lambda.IFunction;

  /**
   * The result handler lambda function.
   */
  public resultHandler: lambda.IFunction;

  /**
   * The table that contains mappings between
   * synthesis jobs and event metadata.
   */
  public table: dynamodb.Table;

  /**
   * The SNS topic to which Amazon Polly will publish
   * synthesis results.
   */
  public resultTopic: sns.Topic;

  /**
   * The builder for the `PollySynthesizer` service.
   */
  static Builder = PollySynthesizerBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: PollySynthesizerProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validating the properties.
    this.props = this.parse(PollySynthesizerSchema, props);

    ///////////////////////////////////////////
    ////////    Processing Storage      ///////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: this.props.kmsKey
    });

    ///////////////////////////////////////////
    ////////    Processing Database      //////
    ///////////////////////////////////////////

    // The table holding mappings between synthesis jobs
    // and document event metadata.
    this.table = new dynamodb.Table(this, 'Table', {
      partitionKey: {
        name: 'SynthesisTaskId',
        type: dynamodb.AttributeType.STRING
      },
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      encryptionKey: props.kmsKey
    });

    ///////////////////////////////////////////
    ///////     Notification Topic      ///////
    ///////////////////////////////////////////

    // The SNS topic to which Amazon Polly will publish
    // synthesis results.
    this.resultTopic = new sns.Topic(this, 'EventBus', {
      masterKey: props.kmsKey
    });

    ///////////////////////////////////////////
    //////     Event Handler Function    //////
    ///////////////////////////////////////////

    // The event handler handles input events.
    this.eventHandler = this.createEventHandler('EventHandler');

    // Plug the SQS queue into the event processor.
    this.eventHandler.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: 1,
      maxConcurrency: DEFAULT_MAX_CONCURRENCY,
      reportBatchItemFailures: true
    }));

    // Allow the event handler to invoke Amazon Polly.
    this.eventHandler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'polly:StartSpeechSynthesisTask',
        'polly:GetSpeechSynthesisTask',
        'polly:ListSpeechSynthesisTasks'
      ],
      resources: ['*']
    }));

    // Allow the event handler write access to the storage.
    this.storage.grantWrite(this.eventHandler);

    // Allow the event handler to publish to the event bus.
    this.resultTopic.grantPublish(this.eventHandler);

    // Allow the event handler to write to the table.
    this.table.grantWriteData(this.eventHandler);

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.eventHandler.grantPrincipal;

    ///////////////////////////////////////////
    //////     Result Handler Function    /////
    ///////////////////////////////////////////

    // The result handler processes results from
    // Amazon Polly.
    this.resultHandler = this.createResultHandler('ResultHandler');

    // Invoke the result handler upon a new SNS message.
    this.resultHandler.addEventSource(new sources.SnsEventSource(this.resultTopic));
    
    // Function permissions.
    this.eventBus.grantPublish(this.resultHandler);
    this.table.grantReadData(this.resultHandler);
    this.storage.grantRead(this.resultHandler);

    // If a KMS key is provided, grant the function
    // permissions to decrypt the documents.
    if (this.props.kmsKey) {
      this.props.kmsKey.grantEncryptDecrypt(this.resultHandler);
    }

    super.bind();
  }

  /**
   * Creates the event handler lambda function.
   * @param id the identifier of the lambda function.
   * @returns the lambda function.
   */
  private createEventHandler(id: string): lambda.IFunction {
    return (new node.NodejsFunction(this, id, {
      description: 'A function creating synthesis tasks on Amazon Polly.',
      entry: path.resolve(__dirname, 'lambdas', 'event-handler', 'index.js'),
      vpc: this.props.vpc,
      timeout: PROCESSING_TIMEOUT,
      runtime: EXECUTION_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: this.props.kmsKey,
      logGroup: this.logGroup,
      insightsVersion: this.props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      environment: {
        POWERTOOLS_SERVICE_NAME: description.name,
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        PROCESSED_FILES_BUCKET: this.storage.id(),
        LANGUAGE_OVERRIDE: this.props.languageOverride ?? '',
        SNS_RESULT_TOPIC: this.resultTopic.topicArn,
        MAPPING_TABLE: this.table.tableName,
        VOICE_MAPPING: JSON.stringify(this.props.voiceMapping)
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-s3',
          '@aws-sdk/client-polly'
        ]
      }
    }));
  }

  /**
   * Creates the result handler lambda function.
   * @param id the identifier of the lambda function.
   * @returns the lambda function.
   */
  private createResultHandler(id: string): lambda.IFunction {
    return (new node.NodejsFunction(this, id, {
      description: 'A function handling results from Amazon Polly.',
      entry: path.resolve(__dirname, 'lambdas', 'result-handler', 'index.js'),
      vpc: this.props.vpc,
      timeout: PROCESSING_TIMEOUT,
      runtime: EXECUTION_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: this.props.kmsKey,
      logGroup: this.logGroup,
      insightsVersion: this.props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      environment: {
        POWERTOOLS_SERVICE_NAME: description.name,
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        SNS_TARGET_TOPIC: this.eventBus.topicArn,
        MAPPING_TABLE: this.table.tableName
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-s3',
          '@aws-sdk/client-sns',
          '@aws-sdk/client-polly'
        ]
      }
    }));
  }

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  grantReadProcessedDocuments(grantee: iam.IGrantable): iam.Grant {
    return (this.storage.grantRead(grantee));
  }

  /**
   * @returns an array of mime-types supported as input
   * type by the data producer.
   */
  supportedInputTypes(): string[] {
    return ([
      'text/plain'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return ([
      'audio/mpeg'
    ]);
  }

  /**
   * @returns the supported compute types by a given
   * middleware.
   */
  supportedComputeTypes(): ComputeType[] {
    return ([
      ComputeType.CPU
    ]);
  }

  /**
   * @returns the middleware conditional statement defining
   * in which conditions this middleware should be executed.
   * In this case, we want the middleware to only be invoked
   * when the document mime-type is supported, and the event
   * type is `document-created`.
   */
  conditional() {
    return (super
      .conditional()
      .and(when('type').equals('document-created'))
    );
  }
}

export * as dsl from './definitions';

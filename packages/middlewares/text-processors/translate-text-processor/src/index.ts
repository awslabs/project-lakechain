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
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CacheStorage } from '@project-lakechain/core';
import { TranslateTextProcessorProps, TranslateTextProcessorSchema } from './definitions/opts';
import { Formality } from './definitions/formality';
import { TranslateLanguage } from './definitions/language-code';

import {
  Middleware,
  MiddlewareBuilder,
  LAMBDA_INSIGHTS_VERSION,
  NAMESPACE
} from '@project-lakechain/core/middleware';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'translate-text-processor',
  description: 'Translates text documents asynchronously using Amazon Translate.',
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
 * Builder for the `TranslateTextProcessor` middleware.
 */
class TranslateTextProcessorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<TranslateTextProcessorProps> = {};

  /**
   * Sets the output languages in which the translation
   * should be produced.
   * @param formats the output formats to use as
   * an output of the translation.
   */
  public withOutputLanguages(languages: TranslateLanguage[]) {
    this.providerProps.outputLanguages = languages;
    return (this);
  }

  /**
   * Specifies a formality tone to use in the
   * translation results.
   * @default false
   */
  public withFormalityTone(formality: Formality) {
    this.providerProps.formality = formality;
    return (this);
  }

  /**
   * Whether to mask profane words in the
   * translation results.
   * @default false
   */
  public withProfanityRedaction(value: boolean) {
    this.providerProps.profanityRedaction = value;
    return (this);
  }

  /**
   * @returns a new instance of the `TranslateTextProcessor`
   * service constructed with the given parameters.
   */
  public build(): TranslateTextProcessor {
    return (new TranslateTextProcessor(
      this.scope,
      this.identifier, {
        ...this.providerProps as TranslateTextProcessorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware allowing to translate text documents
 * asynchronously using Amazon Translate.
 */
export class TranslateTextProcessor extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The table that contains mappings between
   * translation jobs and event metadata.
   */
  public table: dynamodb.Table;

  /**
   * The event handler function.
   */
  public processor: lambda.IFunction;

  /**
   * The result handler function.
   */
  public resultHandler: lambda.IFunction;

  /**
   * The IAM role allowing Amazon Translate to access
   * the audio files.
   */
  private translateRole: iam.IRole;

  /**
   * The builder for the `TranslateTextProcessor` service.
   */
  static Builder = TranslateTextProcessorBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: TranslateTextProcessorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    this.props = this.parse(TranslateTextProcessorSchema, props);

    ///////////////////////////////////////////
    /////////    Processing Storage      //////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: props.kmsKey
    });

    ///////////////////////////////////////////
    ////////    Processing Database      //////
    ///////////////////////////////////////////

    // The table holding mappings between translation jobs
    // and document event metadata.
    this.table = new dynamodb.Table(this, 'Table', {
      partitionKey: {
        name: 'TranslationJobId',
        type: dynamodb.AttributeType.STRING
      },
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      encryptionKey: props.kmsKey
    });

    ///////////////////////////////////////////
    //////    Amazon Translate Role      //////
    ///////////////////////////////////////////

    // The role allowing Amazon Translate to access
    // documents.
    this.translateRole = new iam.Role(this, 'TranslateRole', {
      assumedBy: new iam.ServicePrincipal('translate.amazonaws.com')
    });

    // Allow the Amazon Translate service to read and write
    // from the internal storage.
    this.storage.grantReadWrite(this.translateRole);

    ///////////////////////////////////////////
    /////     Event Handler Function    ///////
    ///////////////////////////////////////////

    this.processor = new node.NodejsFunction(this, 'Compute', {
      description: 'Creates asynchronous translations for documents.',
      entry: path.resolve(__dirname, 'lambdas', 'event-handler', 'index.js'),
      vpc: this.props.vpc,
      timeout: PROCESSING_TIMEOUT,
      runtime: EXECUTION_RUNTIME,
      memorySize: 192,
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
        PROCESSED_FILES_BUCKET: this.storage.id(),
        PROFANITY_REDACTION: this.props.profanityRedaction ? 'true' : 'false',
        FORMALITY: this.props.formality?.toString() ?? 'NONE',
        OUTPUT_LANGUAGES: JSON.stringify(this.props.outputLanguages),
        TRANSLATE_ROLE_ARN: this.translateRole.roleArn,
        MAPPING_TABLE: this.table.tableName
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-s3',
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-translate'
        ]
      }
    });

    // Plug the SQS queue into the lambda function.
    this.processor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: props.batchSize ?? 1,
      maxConcurrency: 2,
      reportBatchItemFailures: true
    }));

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.processor.grantPrincipal;

    // Allowing the function to use Amazon Translate,
    // and Amazon Comprehend for language detection.
    this.processor.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'translate:TranslateDocument',
        'translate:StartTextTranslationJob',
        'comprehend:DetectDominantLanguage'
      ],
      resources: ['*']
    }));

    // Function permissions.
    this.storage.grantWrite(this.processor);
    this.table.grantWriteData(this.processor);
    this.eventBus.grantPublish(this.processor);
    this.translateRole.grantPassRole(this.processor.grantPrincipal);

    ///////////////////////////////////////////
    //////     Result Handler Function    /////
    ///////////////////////////////////////////

    this.resultHandler = new node.NodejsFunction(this, 'ResultHandler', {
      description: 'Handles translation results from Amazon Translate.',
      entry: path.resolve(__dirname, 'lambdas', 'result-handler', 'index.js'),
      vpc: this.props.vpc,
      timeout: cdk.Duration.seconds(10),
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
        PROCESSED_FILES_BUCKET: this.storage.id(),
        MAPPING_TABLE: this.table.tableName
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-s3',
          '@aws-sdk/client-sns',
          '@aws-sdk/client-dynamodb'
        ]
      }
    });

    // We listen for new translation jobs to complete for each translated language,
    // to do that we listen for the creation of the metadata for each languages,
    // by Amazon Translate.
    this.resultHandler.addEventSource(new eventsources.S3EventSource(
      this.storage.getBucket() as s3.Bucket, {
      events: [
        s3.EventType.OBJECT_CREATED
      ],
      filters: [{
        prefix: 'outputs/',
        suffix: '.auxiliary-translation-details.json'
      }]
    }));

    // Function permissions.
    this.eventBus.grantPublish(this.resultHandler);
    this.table.grantReadData(this.resultHandler);
    this.storage.grantRead(this.resultHandler);

    // If a KMS key is provided, grant the function
    // permissions to decrypt the documents.
    if (props.kmsKey) {
      props.kmsKey.grantEncryptDecrypt(this.resultHandler);
    }

    super.bind();
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
      'text/plain',
      'text/html',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/x-xliff+xml'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return (this.supportedInputTypes());
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

export { TranslateLanguage, Formality };

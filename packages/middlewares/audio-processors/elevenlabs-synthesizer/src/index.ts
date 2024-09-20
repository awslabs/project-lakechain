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
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CacheStorage } from '@project-lakechain/core';
import { ElevenLabs } from 'elevenlabs';
import { ElevenLabsSynthesizerProps, ElevenLabsSynthesizerPropsSchema } from './definitions/opts';
import { ElevenLabsModel } from './definitions/model';
import { VoiceSettings } from './definitions/voice-settings';

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
  name: 'elevenlabs-synthesizer',
  description: 'Synthesizes text into speech using the Elevenlabs API.',
  version: '0.10.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.minutes(1);

/**
 * The default maximum batching window for the
 * processing lambda.
 */
const DEFAULT_BATCHING_WINDOW = cdk.Duration.seconds(10);

/**
 * The default batch size for the processing lambda.
 */
const DEFAULT_BATCH_SIZE = 10;

/**
 * The default maximum concurrency for the processing lambda.
 */
const DEFAULT_MAX_CONCURRENCY = 2;

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 256;

/**
 * The builder for the `ElevenLabsSynthesizer` service.
 */
class ElevenLabsSynthesizerBuilder extends MiddlewareBuilder {
  private middlewareProps: Partial<ElevenLabsSynthesizerProps> = {};

  /**
   * Sets the API key to use.
   * @param apiKey the API key to use.
   * @returns the builder instance.
   */
  public withApiKey(apiKey: secrets.ISecret) {
    this.middlewareProps.apiKey = apiKey;
    return (this);
  }

  /**
   * The model to use for the synthesis.
   * @param model the model to use.
   * @default 'eleven_multilingual_v2'
   * @returns the builder instance.
   */
  public withModel(model: ElevenLabsModel) {
    this.middlewareProps.model = model;
    return (this);
  }

  /**
   * The voice to use for the synthesis.
   * @param voice the voice to use.
   * @param settings the voice settings to use.
   * @returns the builder instance.
   */
  public withVoice(voice: string, settings?: VoiceSettings) {
    if (settings) {
      this.middlewareProps.voiceSettings = settings;
    }
    this.middlewareProps.voice = voice;
    return (this);
  }

  /**
   * The output format to use for the synthesis.
   * @param format the format to use.
   * @default mp3_44100_128
   * @returns the builder instance.
   */
  public withOutputFormat(format: ElevenLabs.OutputFormat) {
    this.middlewareProps.outputFormat = format;
    return (this);
  }

  /**
   * @returns a new instance of the `ElevenLabsSynthesizer`
   * service constructed with the given parameters.
   */
  public build(): ElevenLabsSynthesizer {
    return (new ElevenLabsSynthesizer(
      this.scope,
      this.identifier, {
        ...this.middlewareProps as ElevenLabsSynthesizerProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service providing text synthesis capabilities
 * using the Elevenlabs API.
 */
export class ElevenLabsSynthesizer extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The builder for the `ElevenLabsSynthesizer` service.
   */
  public static readonly Builder = ElevenLabsSynthesizerBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: ElevenLabsSynthesizerProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        2 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    this.props = this.parse(ElevenLabsSynthesizerPropsSchema, props);

    ///////////////////////////////////////////
    ////////    Processing Storage      ///////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: this.props.kmsKey
    });

    ///////////////////////////////////////////
    //////    Middleware Event Handler     ////
    ///////////////////////////////////////////

    this.processor = new node.NodejsFunction(this, 'Compute', {
      description: 'A function converting text to speech using the Elevenlabs API.',
      entry: path.resolve(__dirname, 'lambdas', 'processor', 'index.js'),
      vpc: props.vpc,
      memorySize: props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
      timeout: PROCESSING_TIMEOUT,
      runtime: EXECUTION_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: props.kmsKey,
      logGroup: this.logGroup,
      reservedConcurrentExecutions: this.props.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
      insightsVersion: props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      environment: {
        POWERTOOLS_SERVICE_NAME: description.name,
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        SNS_TARGET_TOPIC: this.eventBus.topicArn,
        PROCESSED_FILES_BUCKET: this.storage.id(),
        ELEVENLABS_API_KEY_SECRET_NAME: props.apiKey.secretName,
        ELEVENLABS_MODEL: this.props.model,
        ELEVENLABS_VOICE: this.props.voice,
        ELEVENLABS_VOICE_SETTINGS: this.props.voiceSettings ?
          JSON.stringify(this.props.voiceSettings) :
          '{}',
        ELEVENLABS_OUTPUT_FORMAT: this.props.outputFormat
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-s3',
          '@aws-sdk/client-sns'
        ]
      }
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.processor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.processor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: this.props.batchSize ?? DEFAULT_BATCH_SIZE,
      maxBatchingWindow: this.props.batchingWindow ?? DEFAULT_BATCHING_WINDOW,
      maxConcurrency: this.props.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
      reportBatchItemFailures: true
    }));

    // Grant the compute type permissions to
    // publish to the SNS topic.
    this.eventBus.grantPublish(this.grantPrincipal);

    // Grant the lambda function permissions to
    // write to the storage.
    this.storage.grantWrite(this.processor);

    // Grant the lambda function permissions to
    // read from the API key secret.
    props.apiKey.grantRead(this.processor);

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
   * type by this middleware.
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

export { ElevenLabsModel } from './definitions/model';
export { VoiceSettings } from './definitions/voice-settings';

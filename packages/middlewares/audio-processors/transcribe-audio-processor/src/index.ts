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
import * as s3 from 'aws-cdk-lib/aws-s3';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CacheStorage } from '@project-lakechain/core';
import { OutputFormat } from './definitions/output-format';
import { compile } from './definitions/options-compiler';

import {
  TranscribeAudioProcessorProps,
  TranscribeAudioProcessorSchema
} from './definitions/opts';
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
  name: 'transcribe-audio-processor',
  description: 'Transcribes audio files asynchronously using Amazon Transcribe.',
  version: '0.3.4',
  attrs: {}
};

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME = lambda.Runtime.NODEJS_18_X;

/**
 * Builder for the `TranscribeAudioProcessor` middleware.
 */
class TranscribeAudioProcessorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<TranscribeAudioProcessorProps> = {};

  /**
   * Sets the output format to use.
   * @param formats the output formats to use as
   * an output of the transcription.
   * @default ['vtt']
   */
  public withOutputFormats(...formats: OutputFormat[]) {
    this.providerProps.outputFormats = formats;
    return (this);
  }

  /**
   * @returns a new instance of the `TranscribeAudioProcessor`
   * service constructed with the given parameters.
   */
  public build(): TranscribeAudioProcessor {
    return (new TranscribeAudioProcessor(
      this.scope,
      this.identifier, {
        ...this.providerProps as TranscribeAudioProcessorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware allowing to transcribe audio files
 * asynchronously using Amazon Transcribe.
 */
export class TranscribeAudioProcessor extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The table that contains mappings between
   * transcription jobs and event metadata.
   */
  public table: dynamodb.Table;

  /**
   * The IAM role allowing Amazon Transcribe to access
   * the audio files.
   */
  private transcribeRole: iam.IRole;

  /**
   * The builder for the `TranscribeAudioProcessor` service.
   */
  static Builder = TranscribeAudioProcessorBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: TranscribeAudioProcessorProps) {
    super(scope, id, description, props);

    // Validate the properties.
    this.props = this.parse(TranscribeAudioProcessorSchema, props);

    ///////////////////////////////////////////
    /////////    Processing Storage      //////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: this.props.kmsKey
    });

    ///////////////////////////////////////////
    ////////    Processing Database      //////
    ///////////////////////////////////////////

    // The table holding mappings between transcription jobs
    // and document event metadata.
    this.table = new dynamodb.Table(this, 'Table', {
      partitionKey: {
        name: 'TranscriptionJobId',
        type: dynamodb.AttributeType.STRING
      },
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryptionKey: this.props.kmsKey
    });

    ///////////////////////////////////////////
    //////    Amazon Transcribe Role      /////
    ///////////////////////////////////////////

    // The role allowing Amazon Transcribe to access
    // the audio files.
    this.transcribeRole = new iam.Role(this, 'TranscribeRole', {
      assumedBy: new iam.ServicePrincipal('transcribe.amazonaws.com')
    });

    // Allow the Amazon Transcribe service to write
    // transcription results to the bucket.
    this.storage.grantWrite(this.transcribeRole);

    ///////////////////////////////////////////
    /////     Input Handler Function    ///////
    ///////////////////////////////////////////

    // Handles events from the middleware's input queue and
    // writes them to the DynamoDB table.
    const inputHandler = this.createInputHandler('InputHandler');

    // Function permissions.
    this.table.grantWriteData(inputHandler);
    this.eventQueue.grantConsumeMessages(inputHandler);
    this.transcribeRole.grantPassRole(inputHandler.grantPrincipal);
    this.storage.grantWrite(inputHandler);

    // Allow the function to create transcription jobs.
    inputHandler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'transcribe:StartTranscriptionJob'
      ],
      resources: ['*']
    }));

    // Plug the middleware's input SQS queue into the
    // input handler function.
    inputHandler.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: this.props.batchSize ?? 1,
      maxConcurrency: 5,
      reportBatchItemFailures: true
    }));

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant Amazon Transcribe
    // the permissions to access their resources.
    this.grantPrincipal = inputHandler.grantPrincipal;

    ///////////////////////////////////////////
    //////     Result Handler Function    /////
    ///////////////////////////////////////////

    // Handles transcription results and forwards them
    // to the SNS topic.
    const resultHandler = this.createResultHandler('ResultHandler');

    // Listen for new transcription results on the bucket.
    for (const format of this.props.outputFormats) {
      resultHandler.addEventSource(new sources.S3EventSource(
        this.storage.getBucket() as s3.Bucket, {
        events: [
          s3.EventType.OBJECT_CREATED
        ],
        filters: [{
          prefix: 'transcriptions/',
          suffix: `.${format}`
        }]
      }));
    }

    // Function permissions.
    this.eventBus.grantPublish(resultHandler);
    this.table.grantReadData(resultHandler);
    
    // If a KMS key is provided, grant the function
    // permissions to decrypt the documents.
    if (this.props.kmsKey) {
      this.props.kmsKey.grantEncryptDecrypt(resultHandler);
    }

    super.bind();
  }

  /**
   * Called back when a new source middleware is connected
   * to this middleware. The purpose is to allow the Transcribe
   * role to access the source's processed documents.
   * @param source the source middleware.
   */
  protected onSourceAdded(source: Middleware): void {
    super.onSourceAdded(source);
    source.grantReadProcessedDocuments(this.transcribeRole);
  }

  /**
   * Creates a new input handler function which handles
   * events from the middleware's input queue and writes
   * them to the DynamoDB table for further processing.
   * @param id the construct identifier.
   * @returns the input handler function.
   */
  private createInputHandler(id: string) {
    const handlerPath = path.resolve(__dirname, 'lambdas', 'input-handler');

    // Compiling the properties into options that the Amazon Transcribe
    // API understands.
    const transcribeOptions = compile(
      this.props,
      this.storage.id(),
      this.transcribeRole
    );

    return (new node.NodejsFunction(this, id, {
      description: 'Inserts new transcription jobs in DynamoDB.',
      entry: path.resolve(handlerPath, 'index.js'),
      vpc: this.props.vpc,
      runtime: EXECUTION_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: this.props.kmsKey,
      logGroup: this.logGroup,
      insightsVersion: this.props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      reservedConcurrentExecutions: 5,
      environment: {
        POWERTOOLS_SERVICE_NAME: description.name,
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        MAPPING_TABLE: this.table.tableName,
        TRANSCRIBE_OPTS: JSON.stringify(transcribeOptions)
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-transcribe'
        ]
      }
    }));
  }

  /**
   * @param id the construct identifier.
   * @returns the result handler function which handles
   * transcription results and forwards them to the SNS topic.
   */
  private createResultHandler(id: string) {
    const handlerPath = path.resolve(__dirname, 'lambdas', 'result-handler');

    return (new node.NodejsFunction(this, id, {
      description: 'Listens for transcription results and forwards them to the SNS topic.',
      entry: path.resolve(handlerPath, 'index.js'),
      vpc: this.props.vpc,
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
        MAPPING_TABLE: this.table.tableName,
        SNS_TARGET_TOPIC: this.eventBus.topicArn
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-sns',
          '@aws-sdk/client-dynamodb'
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
      'audio/mpeg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/wav',
      'audio/webm',
      'audio/flac',
      'audio/x-flac',
      'audio/ogg',
      'audio/x-ogg',
      'audio/amr'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return ([
      'application/json+amazon-transcribe',
      'application/x-subrip',
      'text/vtt'
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

export { OutputFormat } from './definitions/output-format';
export { LanguageCode } from './definitions/language-code';
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
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { Intent } from '@project-lakechain/core/dsl/intent';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { RekognitionImageProcessorProps, RekognitionImageProcessorSchema } from './definitions/opts';
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
  name: 'rekognition-image-processor',
  description: 'Processes images using Amazon Rekognition.',
  version: '0.7.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.seconds(30);

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME  = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 192;

/**
 * Builder for the `RekognitionImageProcessor` middleware.
 */
class RekognitionImageProcessorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<RekognitionImageProcessorProps> = {};

  /**
   * @param intent the detection intent to apply.
   */
  public withIntent(intent: Intent) {
    this.providerProps.intent = intent;
    return (this);
  }

  /**
   * @returns a new instance of the `RekognitionImageProcessor`
   * service constructed with the given parameters.
   */
  public build(): RekognitionImageProcessor {
    return (new RekognitionImageProcessor(
      this.scope,
      this.identifier, {
        ...this.providerProps as RekognitionImageProcessorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware allowing to extract metadata from images
 * using the managed Amazon Rekognition service.
 */
export class RekognitionImageProcessor extends Middleware {

  /**
   * The bucket containing processed files.
   */
  public bucket: s3.IBucket;

  /**
   * The event processing lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `RekognitionImageProcessor` service.
   */
  static Builder = RekognitionImageProcessorBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: RekognitionImageProcessorProps) {
    super(scope, id, description, props);

    // Validating the properties.
    this.props = this.parse(RekognitionImageProcessorSchema, props);

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.eventProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'Analyzes images using Amazon Rekognition.',
      entry: path.resolve(__dirname, 'lambdas', 'rekognition', 'index.js'),
      vpc: this.props.vpc,
      memorySize: this.props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
      timeout: PROCESSING_TIMEOUT,
      runtime: EXECUTION_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: this.props.kmsKey,
      logGroup: this.logGroup,
      insightsVersion: props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      environment: {
        POWERTOOLS_SERVICE_NAME: description.name,
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        SNS_TARGET_TOPIC: this.eventBus.topicArn,
        LAKECHAIN_CACHE_STORAGE: this.props.cacheStorage.id(),
        INTENT: this.props.intent.compile()
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
    this.grantPrincipal = this.eventProcessor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.eventProcessor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: this.props.batchSize ?? 2,
      maxConcurrency: 20,
      reportBatchItemFailures: true
    }));

    // Allowing the function to call Amazon Rekognition.
    this.eventProcessor.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rekognition:DetectLabels',
        'rekognition:DetectFaces',
        'rekognition:DetectText',
        'rekognition:DetectModerationLabels',
        'rekognition:DetectProtectiveEquipment'
      ],
      resources: ['*']
    }));

    // Function permissions.
    this.eventBus.grantPublish(this.eventProcessor);

    super.bind();
  }

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  grantReadProcessedDocuments(grantee: iam.IGrantable): iam.Grant {
    // Since this middleware simply passes through the data
    // from the previous middleware, we grant any subsequent
    // middlewares in the pipeline to have read access to the
    // data of all source middlewares.
    for (const source of this.sources) {
      source.grantReadProcessedDocuments(grantee);
    }
    return ({} as iam.Grant);
  }

  /**
   * @returns an array of mime-types supported as input
   * type by the data producer.
   */
  supportedInputTypes(): string[] {
    return ([
      'image/jpeg',
      'image/png'
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

export * as dsl from './definitions/index';
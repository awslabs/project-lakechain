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
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';

import {
  S3StorageConnectorProps,
  S3StorageConnectorPropsSchema,
  StorageClass
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
  name: 's3-storage-connector',
  description: 'Stores documents and their metadata in an S3 Bucket.',
  version: '0.4.0',
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
const EXECUTION_RUNTIME  = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 256;

/**
 * Builder for the `S3StorageConnector` middleware.
 */
class S3StorageConnectorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<S3StorageConnectorProps> = {};

  /**
   * Specifies the destination bucket for the
   * processed documents.
   * @param destination the destination bucket.
   */
  public withDestinationBucket(destination: s3.IBucket) {
    this.providerProps.destinationBucket = destination;
    return (this);
  }

  /**
   * Specifies whether to copy the documents to the
   * destination bucket. If set to false, only the
   * document metadata will be copied.
   * @default true
   */
  public withCopyDocuments(copyDocuments: boolean) {
    this.providerProps.copyDocuments = copyDocuments;
    return (this);
  }

  /**
   * Specifies the storage class to use for storing
   * documents in the destination bucket.
   * @default STANDARD
   */
  public withStorageClass(storageClass: StorageClass) {
    this.providerProps.storageClass = storageClass;
    return (this);
  }

  /**
   * @returns a new instance of the `S3StorageConnector`
   * service constructed with the given parameters.
   */
  public build(): S3StorageConnector {
    return (new S3StorageConnector(
      this.scope,
      this.identifier, {
        ...this.providerProps as S3StorageConnectorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware allowing to store the result of pipelines
 * on an S3 bucket.
 */
export class S3StorageConnector extends Middleware {

  /**
   * The event processing lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `S3StorageConnector` service.
   */
  static Builder = S3StorageConnectorBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: S3StorageConnectorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        3 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validating the properties.
    this.props = this.parse(S3StorageConnectorPropsSchema, props);

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.eventProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'Copy documents and their metadata to an S3 bucket.',
      entry: path.resolve(__dirname, 'lambdas', 'document-handler', 'index.js'),
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
        TARGET_BUCKET: this.props.destinationBucket.bucketName,
        COPY_DOCUMENTS: this.props.copyDocuments ? 'true' : 'false',
        STORAGE_CLASS: this.props.storageClass
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
      batchSize: 5,
      reportBatchItemFailures: true
    }));

    // Function permissions.
    this.eventBus.grantPublish(this.eventProcessor);
    this.props.destinationBucket.grantPut(this.eventProcessor);

    super.bind();
  }

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  grantReadProcessedDocuments(_: iam.IGrantable): iam.Grant {
    return ({} as iam.Grant);
  }

  /**
   * @returns an array of mime-types supported as input
   * type by the data producer.
   */
  supportedInputTypes(): string[] {
    return ([
      '*/*'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return ([]);
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

export { StorageClass } from './definitions/opts';

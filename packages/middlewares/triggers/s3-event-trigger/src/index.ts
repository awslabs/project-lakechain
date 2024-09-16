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
import * as notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as s3 from 'aws-cdk-lib/aws-s3';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { LAMBDA_INSIGHTS_VERSION, Middleware, MiddlewareBuilder, NAMESPACE } from '@project-lakechain/core/middleware';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { S3EventTriggerProps, S3EventTriggerPropsSchema } from './definitions/opts';
import { SourceDescriptor } from './definitions/source-descriptor';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 's3-event-trigger',
  description: 'An event-based trigger for Amazon S3.',
  version: '0.9.0',
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
const EXECUTION_RUNTIME = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 128;

/**
 * Builder for the `S3EventTrigger` middleware.
 */
class S3EventTriggerBuilder extends MiddlewareBuilder {
  private triggerProps: Partial<S3EventTriggerProps> = {};

  /**
   * Adds a new bucket to monitor by the trigger.
   * @param input the description of the bucket to monitor,
   * or a reference to an S3 bucket.
   */
  public withBucket(input: SourceDescriptor | s3.IBucket) {
    let source: SourceDescriptor;

    if (input instanceof s3.Bucket) {
      // If the input is an S3 bucket, we create a
      // source descriptor from it without prefix.
      source = { bucket: input };
    } else {
      source = input as SourceDescriptor;
    }

    if (!this.triggerProps.buckets) {
      this.triggerProps.buckets = [source];
    } else {
      this.triggerProps.buckets.push(source);
    }
    return (this);
  }

  /**
   * Adds a list of buckets to monitor by the trigger.
   * @param sources an array of buckets or source descriptors to monitor.
   */
  public withBuckets(sources: Array<SourceDescriptor | s3.IBucket>) {
    sources.forEach((source) => this.withBucket(source));
    return (this);
  }

  /**
   * Sets whether to fetch the metadata of the S3 objects to
   * enrich the document metadata.
   * @param value whether to fetch the metadata.
   * @default false
   */
  public withFetchMetadata(value: boolean) {
    this.triggerProps.fetchMetadata = value;
    return (this);
  }

  /**
   * @returns a new instance of the `S3EventTrigger`
   * service constructed with the given parameters.
   */
  public build(): S3EventTrigger {
    return (new S3EventTrigger(
      this.scope,
      this.identifier, {
        ...this.triggerProps as S3EventTriggerProps,
        ...this.props
      }
    ));
  }
}

/**
 * Defines an ingestion method where files are processed
 * immediately when uploaded or modified from an S3 bucket.
 */
export class S3EventTrigger extends Middleware {

  /**
   * The event processing lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `S3EventTrigger` service.
   */
  public static readonly Builder = S3EventTriggerBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: S3EventTriggerProps) {
    super(scope, id, description, props);

    // Validating the properties.
    this.props = this.parse(S3EventTriggerPropsSchema, props);

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.eventProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'Forwards S3 events to other middlewares in a pipeline.',
      entry: path.resolve(__dirname, 'lambdas', 'event-handler', 'index.js'),
      memorySize: this.props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
      vpc: this.props.vpc,
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
        FETCH_METADATA: this.props.fetchMetadata ? 'true' : 'false'
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
      batchSize: props.batchSize ?? 10,
      maxBatchingWindow: props.batchingWindow,
      reportBatchItemFailures: true
    }));

    // Function permissions.
    this.eventBus.grantPublish(this.eventProcessor);

    ///////////////////////////////////////////
    //////    Bucket Event Listeners     //////
    ///////////////////////////////////////////

    for (const descriptor of this.props.buckets) {
      const filters: s3.NotificationKeyFilter[] = [];

      // If filters are specified, we add them into
      // the list of filters to apply to the bucket.
      if (descriptor.prefix || descriptor.suffix) {
        filters.push({
          prefix: descriptor.prefix,
          suffix: descriptor.suffix
        });
      }

      // Listen to object creation events.
      descriptor.bucket.addEventNotification(
        s3.EventType.OBJECT_CREATED,
        new notifications.SqsDestination(this.eventQueue),
        ...filters
      );

      // Listen to object deletion events.
      descriptor.bucket.addEventNotification(
        s3.EventType.OBJECT_REMOVED,
        new notifications.SqsDestination(this.eventQueue),
        ...filters
      );

      // Grant the bucket read permissions.
      if (descriptor.prefix) {
        descriptor.bucket.grantRead(this.eventProcessor, `${descriptor.prefix}/*`);
      } else {
        descriptor.bucket.grantRead(this.eventProcessor);
      }
    }

    super.bind();
  }

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  grantReadProcessedDocuments(grantee: iam.IGrantable): iam.Grant {
    for (const description of this.props.buckets) {
      description.bucket.grantRead(grantee);
    }
    return ({} as iam.Grant);
  }

  /**
   * @returns an array of mime-types supported as input
   * type by the data producer.
   */
  supportedInputTypes(): string[] {
    return ([
      'application/json+s3-event'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return ([
      '*/*'
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
}

export * from './definitions/source-descriptor';

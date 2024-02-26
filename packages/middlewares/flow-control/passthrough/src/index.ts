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

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { PassthroughProps, PassthroughPropsSchema } from './definitions/opts';
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
  name: 'passthrough',
  description: 'A middleware acting as a passthrough logging received events.',
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
const EXECUTION_RUNTIME = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 128;

/**
 * Builder for the `Passthrough` middleware.
 */
class PassthroughBuilder extends MiddlewareBuilder {
  private providerProps: Partial<PassthroughProps> = {};

  /**
   * Whether to dump the metadata of the document and
   * resolve pointers into their actual values.
   * @param resolveMetadata whether to resolve the metadata.
   * @returns the builder instance.
   */
  public withResolveMetadata(resolveMetadata: boolean) {
    this.providerProps.resolveMetadata = resolveMetadata;
    return (this);
  }

  /**
   * @returns a new instance of the `Passthrough`
   * service constructed with the given parameters.
   */
  public build(): Passthrough {
    return (new Passthrough(
      this.scope,
      this.identifier, {
        ...this.providerProps as PassthroughProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware acting as a passthrough for events.
 */
export class Passthrough extends Middleware {

  /**
   * The event processing lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `Passthrough` service.
   */
  static Builder = PassthroughBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, props: PassthroughProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validating the properties.
    props = this.parse(PassthroughPropsSchema, props);

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.eventProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'A function acting as a passthrough for logging events.',
      entry: path.resolve(__dirname, 'lambdas', 'passthrough', 'index.js'),
      vpc: props.vpc,
      memorySize: props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
      timeout: PROCESSING_TIMEOUT,
      runtime: EXECUTION_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: props.kmsKey,
      logGroup: this.logGroup,
      insightsVersion: props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      environment: {
        POWERTOOLS_SERVICE_NAME: description.name,
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        SNS_TARGET_TOPIC: this.eventBus.topicArn,
        LAKECHAIN_CACHE_STORAGE: props.cacheStorage.id(),
        RESOLVE_METADATA: props.resolveMetadata ? 'true' : 'false'
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
      '*/*'
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

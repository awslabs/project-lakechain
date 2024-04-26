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

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CacheStorage } from '@project-lakechain/core';
import { LayerOperation } from './definitions';
import { ImageLayerProcessorProps, ImageLayerProcessorPropsSchema } from './definitions/opts';

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
  name: 'image-layer-processor',
  description: 'Applies layer operations on images.',
  version: '0.7.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.minutes(1);

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 512;

/**
 * Builder for the `ImageLayerProcessor` middleware.
 */
class ImageLayerProcessorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<ImageLayerProcessorProps> = {};

  /**
   * Specifies the layer operation to apply on
   * the image.
   * @param layers the layer operation to apply.
   */
  public withLayers(...layers: LayerOperation[]) {
    this.providerProps.layers = layers;
    return (this);
  }

  /**
   * @returns a new instance of the `ImageLayerProcessor`
   * service constructed with the given parameters.
   */
  public build(): ImageLayerProcessor {
    return (new ImageLayerProcessor(
      this.scope,
      this.identifier, {
        ...this.providerProps as ImageLayerProcessorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware allowing to highlight faces and objects
 * on images.
 */
export class ImageLayerProcessor extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The event processing lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `ImageLayerProcessor` service.
   */
  static Builder = ImageLayerProcessorBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: ImageLayerProcessorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validating the properties.
    this.props = this.parse(ImageLayerProcessorPropsSchema, props);

    ///////////////////////////////////////////
    ////////    Processing Storage      ///////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: this.props.kmsKey
    });

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.eventProcessor = new lambda.DockerImageFunction(this, 'Compute', {
      description: 'Highlights faces and objects on images.',
      code: lambda.DockerImageCode.fromImageAsset(
        path.resolve(__dirname, 'lambdas', 'filter-processor')
      ),
      vpc: this.props.vpc,
      memorySize: this.props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
      timeout: PROCESSING_TIMEOUT,
      architecture: lambda.Architecture.X86_64,
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
        PROCESSED_FILES_BUCKET: this.storage.id(),
        FILTERS: JSON.stringify(this.props.layers)
      }
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.eventProcessor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.eventProcessor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: this.props.batchSize ?? 10,
      reportBatchItemFailures: true
    }));

    // Function permissions.
    this.eventBus.grantPublish(this.eventProcessor);
    this.storage.grantWrite(this.eventProcessor);

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
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/webp'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return ([
      'image/jpeg',
      'image/png',
      'image/bmp',
      'image/gif'
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
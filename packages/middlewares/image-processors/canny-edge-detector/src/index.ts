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
import { CannyEdgeDetectorProps, CannyEdgeDetectorPropsSchema } from './definitions/opts';

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
  name: 'canny-edge-detector',
  description: 'Creates a new image with the edges detected using the Canny edge detector algorithm.',
  version: '0.9.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.seconds(30);

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 768;

/**
 * Builder for the `CannyEdgeDetector` middleware.
 */
class CannyEdgeDetectorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<CannyEdgeDetectorProps> = {};

  /**
   * Sets the lower threshold of the hysteresis procedure.
   * Edges with intensity gradients below this value will be discarded.
   * @default 100
   */
  public withLowerThreshold(lowerThreshold: number) {
    this.providerProps.lowerThreshold = lowerThreshold;
    return (this);
  }

  /**
   * Sets the upper threshold of the hysteresis procedure.
   * Edges with intensity gradients above this value will be considered strong edges.
   * @default 200
   */
  public withUpperThreshold(upperThreshold: number) {
    this.providerProps.upperThreshold = upperThreshold;
    return (this);
  }

  /**
   * Sets the size of the Sobel kernel used for edge detection.
   * This parameter affects the level of detail in the edges detected.
   * @note valid values are 3, 5, and 7.
   * @default 3
   */
  public withApertureSize(apertureSize: 3 | 5 | 7) {
    this.providerProps.apertureSize = apertureSize;
    return (this);
  }

  /**
   * Specifies the equation for finding gradient magnitude.
   * @default false
   */
  public withL2Gradient(l2Gradient: boolean) {
    this.providerProps.l2Gradient = l2Gradient;
    return (this);
  }

  /**
   * @returns a new instance of the `CannyEdgeDetector`
   * service constructed with the given parameters.
   */
  public build(): CannyEdgeDetector {
    return (new CannyEdgeDetector(
      this.scope,
      this.identifier, {
        ...this.providerProps as CannyEdgeDetectorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware allowing to compute the Laplacian variance
 * of images.
 */
export class CannyEdgeDetector extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The event processing lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `CannyEdgeDetector` service.
   */
  public static readonly Builder = CannyEdgeDetectorBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: CannyEdgeDetectorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        3 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validating the properties.
    this.props = this.parse(CannyEdgeDetectorPropsSchema, props);

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
      description: 'Creates a canny edge image.',
      code: lambda.DockerImageCode.fromImageAsset(
        path.resolve(__dirname, 'lambdas', 'processor')
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
        LOWER_THRESHOLD: `${this.props.lowerThreshold}`,
        UPPER_THRESHOLD: `${this.props.upperThreshold}`,
        APERTURE_SIZE: `${this.props.apertureSize}`,
        L2_GRADIENT: this.props.l2Gradient ? 'True' : 'False'
      }
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.eventProcessor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.eventProcessor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: this.props.batchSize ?? 2,
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
      'image/bmp',
      'image/webp'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return ([
      'image/png'
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

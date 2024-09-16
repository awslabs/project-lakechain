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
import { HashingImageProcessorProps, HashingImageProcessorPropsSchema } from './definitions/opts';

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
  name: 'hashing-image-processor',
  description: 'Computes the hashes of images using different algorithms.',
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
const DEFAULT_MEMORY_SIZE = 512;

/**
 * Builder for the `HashingImageProcessor` middleware.
 */
class HashingImageProcessorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<HashingImageProcessorProps> = {};

  /**
   * Sets whether to compute the average hash of images.
   * @default true
   * @param averageHashing whether to compute the average hash of images.
   * @returns the builder instance.
   */
  public withAverageHashing(averageHashing: boolean): HashingImageProcessorBuilder {
    this.providerProps.averageHashing = averageHashing;
    return (this);
  }

  /**
   * Sets whether to compute the perceptual hash of images.
   * @default true
   * @param perceptualHashing whether to compute the perceptual hash of images.
   * @returns the builder instance.
   */
  public withPerceptualHashing(perceptualHashing: boolean): HashingImageProcessorBuilder {
    this.providerProps.perceptualHashing = perceptualHashing;
    return (this);
  }

  /**
   * Sets whether to compute the difference hash of images.
   * @default true
   * @param differenceHashing whether to compute the difference hash of images.
   * @returns the builder instance.
   */
  public withDifferenceHashing(differenceHashing: boolean): HashingImageProcessorBuilder {
    this.providerProps.differenceHashing = differenceHashing;
    return (this);
  }

  /**
   * Sets whether to compute the wavelet hash of images.
   * @default true
   * @param waveletHashing whether to compute the wavelet hash of images.
   * @returns the builder instance.
   */
  public withWaveletHashing(waveletHashing: boolean): HashingImageProcessorBuilder {
    this.providerProps.waveletHashing = waveletHashing;
    return (this);
  }

  /**
   * Sets whether to compute the color hash of images.
   * @default true
   * @param colorHashing whether to compute the color hash of images.
   * @returns the builder instance.
   */
  public withColorHashing(colorHashing: boolean): HashingImageProcessorBuilder {
    this.providerProps.colorHashing = colorHashing;
    return (this);
  }

  /**
   * @returns a new instance of the `HashingImageProcessor`
   * service constructed with the given parameters.
   */
  public build(): HashingImageProcessor {
    return (new HashingImageProcessor(
      this.scope,
      this.identifier, {
        ...this.providerProps as HashingImageProcessorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware allowing to compute the Laplacian variance
 * of images.
 */
export class HashingImageProcessor extends Middleware {

  /**
   * The event processing lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `HashingImageProcessor` service.
   */
  public static readonly Builder = HashingImageProcessorBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: HashingImageProcessorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        3 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validating the properties.
    this.props = this.parse(HashingImageProcessorPropsSchema, props);

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.eventProcessor = new lambda.DockerImageFunction(this, 'Compute', {
      description: 'Computes the hashes of images using different algorithms.',
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
        AVERAGE_HASHING: this.props.averageHashing ? 'true' : 'false',
        PERCEPTUAL_HASHING: this.props.perceptualHashing ? 'true' : 'false',
        DIFFERENCE_HASHING: this.props.differenceHashing ? 'true' : 'false',
        WAVELET_HASHING: this.props.waveletHashing ? 'true' : 'false',
        COLOR_HASHING: this.props.colorHashing ? 'true' : 'false'
      }
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.eventProcessor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.eventProcessor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: this.props.batchSize ?? 1,
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
    // middlewares in the pipeline read access to the
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

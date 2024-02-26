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
import { TilingTextSplitterProps, TilingTextSplitterPropsSchema } from './definitions/opts';

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
  name: 'tiling-text-splitter',
  description: 'Transforms text into chunks of tokens using the NLTK tiling algorithm.',
  version: '0.4.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.minutes(5);

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 512;

/**
 * The builder class for the `TilingTextSplitter` service.
 */
class TilingTextSplitterBuilder extends MiddlewareBuilder {
  private providerProps: Partial<TilingTextSplitterProps> = {};

  /**
   * Sets the pseudo sentence size for the tiling
   * algorithm.
   * @param pseudoSentenceSize the pseudo sentence size.
   * @returns the builder itself.
   */
  public withPseudoSentenceSize(pseudoSentenceSize: number) {
    this.providerProps.pseudoSentenceSize = pseudoSentenceSize;
    return (this);
  }

  /**
   * @returns a new instance of the `TilingTextSplitter`
   * service constructed with the given parameters.
   */
  public build(): TilingTextSplitter {
    return (new TilingTextSplitter(
      this.scope,
      this.identifier, {
        ...this.providerProps as TilingTextSplitterProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service allowing to split text corpora into
 * chunks of text.
 */
export class TilingTextSplitter extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The builder for the `TilingTextSplitter` service.
   */
  static Builder = TilingTextSplitterBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, props: TilingTextSplitterProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    props = this.parse(TilingTextSplitterPropsSchema, props);

    ///////////////////////////////////////////
    /////////    Processing Storage      //////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: props.kmsKey
    });

    ///////////////////////////////////////////
    //////    Middleware Event Handler     ////
    ///////////////////////////////////////////

    this.processor = new lambda.DockerImageFunction(this, 'Compute', {
      description: 'A function splitting text documents into tiles.',
      code: lambda.DockerImageCode.fromImageAsset(
        path.resolve(__dirname, 'lambdas', 'text-splitter')
      ),
      vpc: props.vpc,
      memorySize: props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
      timeout: PROCESSING_TIMEOUT,
      architecture: lambda.Architecture.X86_64,
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
        PROCESSED_FILES_BUCKET: this.storage.id(),
        PSEUDO_SENTENCE_SIZE: `${props.pseudoSentenceSize}`,
        CACHE_DIR: '/tmp'
      }
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.processor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.processor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: props.batchSize ?? 5,
      reportBatchItemFailures: true
    }));

    // Function permissions.
    this.storage.grantWrite(this.processor);
    this.eventBus.grantPublish(this.processor);

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
      'text/plain'
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
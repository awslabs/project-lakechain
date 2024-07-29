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
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CohereEmbeddingModel } from './definitions/embedding-model';
import { CohereEmbeddingProps, CohereEmbeddingPropsSchema } from './definitions/opts';

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
  name: 'cohere-embedding-processor',
  description: 'Creates embeddings from documents using Cohere models.',
  version: '0.7.0',
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
const DEFAULT_MEMORY_SIZE = 128;

/**
 * The builder for the `CohereEmbeddingProcessor` service.
 */
class CohereEmbeddingProcessorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<CohereEmbeddingProps> = {};

  /**
   * Sets the embedding model to use.
   * @param model the embedding model to use.
   */
  public withModel(model: CohereEmbeddingModel) {
    this.providerProps.model = model;
    return (this);
  }

  /**
   * Sets the AWS region in which the model
   * will be invoked.
   * @param region the AWS region in which the model
   * will be invoked.
   */
  public withRegion(region: string) {
    this.providerProps.region = region;
    return (this);
  }

  /**
   * @returns a new instance of the `CohereEmbeddingProcessor`
   * service constructed with the given parameters.
   */
  public build(): CohereEmbeddingProcessor {
    return (new CohereEmbeddingProcessor(
      this.scope,
      this.identifier, {
        ...this.providerProps as CohereEmbeddingProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service allowing to create embeddings for text
 * chunks using the OpenAI API.
 */
export class CohereEmbeddingProcessor extends Middleware {

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * Principal allowing to grant permissions to
   * the processing lambda.
   */
  public readonly grantPrincipal: iam.IPrincipal;

  /**
   * The builder for the `CohereEmbeddingProcessor` service.
   */
  public static readonly Builder = CohereEmbeddingProcessorBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, props: CohereEmbeddingProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    props = this.parse(CohereEmbeddingPropsSchema, props);

    /////////////////////////////////////////
    /////   Middleware Event Handler    /////
    /////////////////////////////////////////

    this.processor = new node.NodejsFunction(this, 'Compute', {
      description: 'A function creating vector embeddings using Cohere models.',
      entry: path.resolve(__dirname, 'lambdas', 'vectorizer', 'index.js'),
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
        EMBEDDING_MODEL: JSON.stringify(props.model),
        BEDROCK_REGION: props.region ?? ''
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

    // Allow access to the Bedrock API.
    this.processor.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel'
      ],
      resources: [
        `arn:${cdk.Aws.PARTITION}:bedrock:${props.region}::foundation-model/${props.model.name}`,
      ]
    }));

    // Plug the SQS queue into the lambda function.
    this.processor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: props.batchSize ?? 2,
      maxConcurrency: 5,
      reportBatchItemFailures: true
    }));

    // Grant the lambda function permissions to
    // publish to the SNS topic.
    this.eventBus.grantPublish(this.processor);

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
   * type by this middleware.
   */
  supportedInputTypes(): string[] {
    return ([
      'text/plain',
      'text/markdown'
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

export * from './definitions/embedding-model';
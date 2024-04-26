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
import * as r from '@project-lakechain/core/dsl/vocabulary/reference';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CacheStorage } from '@project-lakechain/core';
import { SdxlImageModel } from './definitions/image-model.js';

import {
  SdxlImageGeneratorProps,
  SdxlImageGeneratorPropsSchema,
  ModelParameters
} from './definitions/opts.js';
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
  name: 'sdxl-image-generator',
  description: 'Generates images with Generative AI using SDXL on Amazon Bedrock.',
  version: '0.7.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.minutes(2);

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME  = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 256;

/**
 * The builder for the `SdxlImageGenerator` service.
 */
class SdxlImageGeneratorBuilder extends MiddlewareBuilder {
  private middlewareProps: Partial<SdxlImageGeneratorProps> = {};

  /**
   * Sets the Bedrock image model to use for generating
   * images.
   * @param model the Bedrock image model to use.
   */
  public withImageModel(model: SdxlImageModel) {
    this.middlewareProps.imageModel = model;
    return (this);
  }

  /**
   * Sets the parameters to pass to the image model.
   * @param parameters the parameters to pass to the image model.
   * @default {}
   */
  public withModelParameters(parameters: ModelParameters) {
    this.middlewareProps.modelParameters = parameters;
    return (this);
  }

  /**
   * Sets the prompt to use for generating images.
   * @param prompt the prompt to use for generating images.
   */
  public withPrompt(prompt: string | r.IReference<any>) {
    let reference = null;

    if (typeof prompt === 'string') {
      reference = r.reference(r.value(prompt));
    } else {
      reference = prompt;
    }

    this.middlewareProps.prompt = reference;
    return (this);
  }

  /**
   * Sets the negative prompts to use when generating images.
   * @param prompts the negative prompts to use when generating images.
   * @default []
   */
  public withNegativePrompts(prompts: Array<string | r.IReference<any>>) {
    const references = [];

    for (const prompt of prompts) {
      if (typeof prompt === 'string') {
        references.push(r.reference(r.value(prompt)));
      } else {
        references.push(prompt);
      }
    }

    this.middlewareProps.negativePrompts = references;
    return (this);
  }

  /**
   * Sets the AWS region in which the model
   * will be invoked.
   * @param region the AWS region in which the model
   * will be invoked.
   */
  public withRegion(region: string) {
    this.middlewareProps.region = region;
    return (this);
  }

  /**
   * @returns a new instance of the `SdxlImageGenerator`
   * service constructed with the given parameters.
   */
  public build(): SdxlImageGenerator {
    return (new SdxlImageGenerator(
      this.scope,
      this.identifier, {
        ...this.middlewareProps as SdxlImageGeneratorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service providing image generation using SDXL
 * on Amazon Bedrock.
 */
export class SdxlImageGenerator extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The data processor lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `SdxlImageGenerator` service.
   */
  static Builder = SdxlImageGeneratorBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: SdxlImageGeneratorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        2 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    this.props = this.parse(SdxlImageGeneratorPropsSchema, props);

    ///////////////////////////////////////////
    ////////    Processing Storage      ///////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: this.props.kmsKey
    });

    ///////////////////////////////////////////
    //////    Middleware Event Handler     ////
    ///////////////////////////////////////////

    this.eventProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'Generates images using SDXL on Amazon Bedrock.',
      entry: path.resolve(__dirname, 'lambdas', 'handler', 'index.js'),
      vpc: this.props.vpc,
      memorySize: this.props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
      timeout: PROCESSING_TIMEOUT,
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
        SNS_TARGET_TOPIC: this.eventBus.topicArn,
        PROCESSED_FILES_BUCKET: this.storage.id(),
        IMAGE_MODEL: this.props.imageModel.name,
        PROMPT: JSON.stringify(this.props.prompt),
        NEGATIVE_PROMPTS: JSON.stringify(this.props.negativePrompts),
        MODEL_PARAMETERS: JSON.stringify(this.props.modelParameters),
        BEDROCK_REGION: this.props.region ?? ''
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
      batchSize: this.props.batchSize ?? 1,
      maxConcurrency: 2,
      reportBatchItemFailures: true
    }));

    // Allow access to the Bedrock API.
    this.eventProcessor.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel'
      ],
      resources: [
        `arn:${cdk.Aws.PARTITION}:bedrock:${this.props.region ?? cdk.Aws.REGION}::foundation-model/${this.props.imageModel.name}`,
      ]
    }));

    // Grant the compute type permissions to
    // write to the post-processing bucket.
    this.storage.grantWrite(this.grantPrincipal);

    // Grant the compute type permissions to
    // publish to the SNS topic.
    this.eventBus.grantPublish(this.grantPrincipal);

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
      'text/plain',
      'image/png',
      'image/jpeg',
      'application/json+scheduler'
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

export { SdxlImageModel } from './definitions/image-model.js';
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
import serialize from 'serialize-javascript';
import sharp from 'sharp';

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';
import * as esbuild from 'esbuild';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { SharpLayer } from '@project-lakechain/layers/sharp';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CacheStorage } from '@project-lakechain/core';
import { SharpOperations } from './definitions';
import { IntentExpression, SharpImageTransformProps, SharpImageTransformSchema } from './definitions/opts';

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
  name: 'sharp-image-transform',
  description: 'Transforms images using the sharp library.',
  version: '0.7.0',
  attrs: {}
};

/**
 * The name of the callable expression to invoke
 * the user-provided intent.
 */
const INTENT_SYMBOL = '__callable';

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.minutes(1);

/**
 * The lambda execution runtime.
 */
const EXECUTION_RUNTIME  = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 1024;

/**
 * Builder for the `SharpImageTransform` middleware.
 */
class SharpImageTransformBuilder extends MiddlewareBuilder {
  private providerProps: Partial<SharpImageTransformProps> = {};

  /**
   * @param sharpTransforms the sharp transforms to apply.
   */
  public withSharpTransforms(sharpTransforms: SharpOperations | IntentExpression) {
    this.providerProps.sharpTransforms = sharpTransforms;
    return (this);
  }

  /**
   * @returns a new instance of the `SharpImageTransform`
   * service constructed with the given parameters.
   */
  public build(): SharpImageTransform {
    return (new SharpImageTransform(
      this.scope,
      this.identifier, {
        ...this.providerProps as SharpImageTransformProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware allowing to transform images using the
 * sharp library.
 */
export class SharpImageTransform extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The event processing lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `SharpImageTransform` service.
   */
  static Builder = SharpImageTransformBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: SharpImageTransformProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    this.props = this.parse(SharpImageTransformSchema, props);

    ///////////////////////////////////////////
    ///////    Transform Expression      //////
    ///////////////////////////////////////////

    let type = 'expression';
    let expression = null;

    if (this.props.sharpTransforms instanceof SharpOperations) {
      // Verify whether the transforms are valid.
      const ops = this.props.sharpTransforms.getOps();
      if (!ops.length) {
        throw new Error('At least one Sharp transform must be specified.');
      }
      expression = JSON.stringify(ops);
    } else {
      expression = this.serializeFn(this.props.sharpTransforms);
      type = 'funclet';
    }

    ///////////////////////////////////////////
    ////////    Processing Storage      ///////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: this.props.kmsKey
    });

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.eventProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'Transforms images using the Sharp library.',
      entry: path.resolve(__dirname, 'lambdas', 'sharp', 'index.js'),
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
        PROCESSED_FILES_BUCKET: this.storage.id(),
        OPS_TYPE: type,
        INTENT: type === 'expression' ?
          JSON.stringify(expression) :
          expression,
        INTENT_SYMBOL
      },
      layers: [
        SharpLayer.arm64(this, 'SharpLayer')
      ],
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-s3',
          '@aws-sdk/client-sns',
          'sharp'
        ]
      }
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.eventProcessor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.eventProcessor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: props.batchSize ?? 5,
      reportBatchItemFailures: true
    }));

    // Function permissions.
    this.eventBus.grantPublish(this.eventProcessor);
    this.storage.grantWrite(this.eventProcessor);

    super.bind();
  }

  /**
   * A helper used to serialize the user-provided intent into a string.
   * This function also uses `esbuild` to validate the syntax of the
   * provided function and minify it.
   * @param fn the function to serialize.
   * @param opts the esbuild transform options.
   * @returns the serialized function.
   */
  private serializeFn(fn: IntentExpression, opts?: esbuild.TransformOptions): string {
    const res = esbuild.transformSync(`const ${INTENT_SYMBOL} = ${serialize(fn)}\n`, {
      minify: true,
      ...opts
    });
    return (res.code);
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
      'image/webp',
      'image/avif',
      'image/gif',
      'image/heic',
      'image/heif'
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

export { sharp } from './definitions/index';
export { CloudEvent } from '@project-lakechain/sdk';
export { SharpFunction, SharpObject } from './definitions/opts';

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

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';
import * as esbuild from 'esbuild';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl';

import {
  ConditionProps,
  ConditionPropsSchema,
  ConditionalExpression
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
  name: 'condition',
  description: 'A middleware allowing to express complex conditions in pipelines.',
  version: '0.4.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.seconds(10);

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 128;

/**
 * The name of the conditional callable to invoke
 * the conditional expression.
 */
const CONDITIONAL_SYMBOL = '__callable';

/**
 * Builder for the `Condition` middleware.
 */
class ConditionBuilder extends MiddlewareBuilder {
  private providerProps: Partial<ConditionProps> = {};

  /**
   * The time or Condition duration at which the pipeline
   * should resume.
   * @param time the time or Condition duration.
   * @returns the builder instance.
   */
  public withConditional(conditional: ConditionalExpression | lambda.IFunction) {
    this.providerProps.conditional = conditional;
    return (this);
  }

  /**
   * @returns a new instance of the `Condition`
   * service constructed with the given parameters.
   */
  public build(): Condition {
    return (new Condition(
      this.scope,
      this.identifier, {
        ...this.providerProps as ConditionProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware acting as a Condition for events.
 */
export class Condition extends Middleware {

  /**
   * The event processing lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `Condition` service.
   */
  static Builder = ConditionBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, props: ConditionProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        3 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validating the properties.
    props = this.parse(ConditionPropsSchema, props);

    ///////////////////////////////////////////
    //////    Conditional Expression      /////
    ///////////////////////////////////////////

    let conditional: string;

    if (props.conditional instanceof lambda.Function) {
      conditional = props.conditional.functionArn;
    } else if (typeof props.conditional === 'function') {
      conditional = this.serializeFn(props.conditional);
    } else {
      throw new Error(`
        Invalid or missing conditional expression in condition middleware.
      `);
    }

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.eventProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'A function evaluating a conditional expression.',
      entry: path.resolve(__dirname, 'lambdas', 'condition-evaluation', 'index.js'),
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
        CONDITIONAL_TYPE: props.conditional instanceof lambda.Function ?
          'lambda' :
          'expression',
        CONDITIONAL: conditional,
        CONDITIONAL_SYMBOL
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

    // If the conditional is a lambda function, grant
    // the processing lambda the permission to invoke it.
    if (props.conditional instanceof lambda.Function) {
      props.conditional.grantInvoke(this.eventProcessor);
    }

    // Allow the function to publish to the SNS topic.
    this.eventBus.grantPublish(this.eventProcessor);

    // Plug the SQS queue into the lambda function.
    this.eventProcessor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: props.batchSize ?? 10,
      maxBatchingWindow: props.batchingWindow,
      reportBatchItemFailures: true
    }));

    super.bind();
  }

  /**
   * A helper used to serialize the different types of JavaScript
   * functions that the user can provide (e.g functions, arrow functions,
   * async functions, etc.) into a string.
   * This function also uses `esbuild` to validate the syntax of the
   * provided function and minify it.
   * @param fn the function to serialize.
   * @param opts the esbuild transform options.
   * @returns the serialized function.
   */
  private serializeFn(fn: ConditionalExpression, opts?: esbuild.TransformOptions): string {
    const res = esbuild.transformSync(`const ${CONDITIONAL_SYMBOL} = ${serialize(fn)}\n`, {
      minify: true,
      ...opts
    });
    return (res.code);
  }

  /**
   * Defines the next middleware to execute when the
   * condition is matched.
   * @param consumer the next middleware to execute.
   * @returns a reference to this middleware.
   */
  public onMatch(consumer: Middleware): Middleware {
    return (this.pipe(consumer, consumer.conditional()
      .and(
        when('data.metadata.custom.__condition_result').equals('true')
      )));
  }

  /**
   * Defines the next middleware to execute when the
   * condition is not matched.
   * @param consumer the next middleware to execute.
   * @returns a reference to this middleware.
   */
  public onMismatch(consumer: Middleware): Middleware {
    return (this.pipe(consumer, consumer.conditional()
      .and(
        when('data.metadata.custom.__condition_result').equals('false')
      )));
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

export { ConditionalExpression } from './definitions/opts';
export { CloudEvent } from '@project-lakechain/sdk';

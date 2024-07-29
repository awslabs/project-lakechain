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
import * as sqs from 'aws-cdk-lib/aws-sqs';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { LAMBDA_INSIGHTS_VERSION, Middleware, MiddlewareBuilder, NAMESPACE } from '@project-lakechain/core/middleware';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { SqsEventTriggerProps, SqsEventTriggerPropsSchema } from './definitions/opts';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'sqs-event-trigger',
  description: 'An event-based data source for Amazon SQS.',
  version: '0.7.0',
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
 * Builder for the `SqsEventTrigger` middleware.
 */
class SqsEventTriggerBuilder extends MiddlewareBuilder {
  private triggerProps: Partial<SqsEventTriggerProps> = {};

  /**
   * Adds a new queue to monitor for events.
   * @param queue the SQS queue to monitor.
   */
  public withQueue(queue: sqs.Queue) {
    if (!this.triggerProps.queues) {
      this.triggerProps.queues = [queue];
    } else {
      this.triggerProps.queues.push(queue);
    }
    return (this);
  }

  /**
   * Adds a list of SQS queues to monitor by the trigger.
   * @param queues an array of SQS queues to monitor.
   */
  public withQueues(queues: sqs.Queue[]) {
    queues.forEach((queue) => this.withQueue(queue));
    return (this);
  }

  /**
   * @returns a new instance of the `SqsEventTrigger`
   * service constructed with the given parameters.
   */
  public build(): SqsEventTrigger {
    return (new SqsEventTrigger(
      this.scope,
      this.identifier, {
        ...this.triggerProps as SqsEventTriggerProps,
        ...this.props
      }
    ));
  }
}

/**
 * A trigger monitoring on or multiple SQS queues
 * for events containing documents to process.
 */
export class SqsEventTrigger extends Middleware {

  /**
   * The event processing lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `SqsEventTrigger` service.
   */
  public static readonly Builder = SqsEventTriggerBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: SqsEventTriggerProps) {
    super(scope, id, description, props);

    // Validating the properties.
    this.props = this.parse(SqsEventTriggerPropsSchema, props);

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    // The lambda function.
    this.eventProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'Forwards SQS events to other middlewares in a pipeline.',
      entry: path.resolve(__dirname, 'lambdas', 'event-handler', 'index.js'),
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
        SNS_TARGET_TOPIC: this.eventBus.topicArn
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

    // Plug the input queues into the lambda function.
    for (const queue of this.props.queues) {
      this.eventProcessor.addEventSource(new sources.SqsEventSource(queue, {
        batchSize: props.batchSize ?? 10,
        maxBatchingWindow: props.batchingWindow,
        reportBatchItemFailures: true
      }));
    }

    // Function permissions.
    this.eventBus.grantPublish(this.eventProcessor);

    super.bind();
  }

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  grantReadProcessedDocuments(grantee: iam.IGrantable): iam.Grant {
    for (const queue of this.props.queues) {
      queue.grantConsumeMessages(grantee);
    }
    return ({} as iam.Grant);
  }

  /**
   * @returns an array of mime-types supported as input
   * type by the data producer.
   */
  supportedInputTypes(): string[] {
    return ([]);
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

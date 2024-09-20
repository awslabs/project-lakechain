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
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { DelayProps, DelayPropsSchema } from './definitions/opts';
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
  name: 'delay',
  description: 'A middleware inserting a time delay within a pipeline.',
  version: '0.10.0',
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
 * Builder for the `Delay` middleware.
 */
class DelayBuilder extends MiddlewareBuilder {
  private providerProps: Partial<DelayProps> = {};

  /**
   * The time or delay duration at which the pipeline
   * should resume.
   * @param time the time or delay duration.
   * @returns the builder instance.
   */
  public withTime(time: cdk.Duration | Date) {
    this.providerProps.time = time;
    return (this);
  }

  /**
   * @returns a new instance of the `Delay`
   * service constructed with the given parameters.
   */
  public build(): Delay {
    return (new Delay(
      this.scope,
      this.identifier, {
        ...this.providerProps as DelayProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware acting as a delay for events.
 */
export class Delay extends Middleware {

  /**
   * The event processing lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `Delay` service.
   */
  public static readonly Builder = DelayBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, props: DelayProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validating the properties.
    props = this.parse(DelayPropsSchema, props);

    ///////////////////////////////////////////
    //////////    State Machine      //////////
    ///////////////////////////////////////////

    // The delay step associated with the user delay.
    const delayStep = new sfn.Wait(this, 'DelayStep', {
      time: props.time instanceof cdk.Duration ?
        sfn.WaitTime.duration(props.time) :
        sfn.WaitTime.timestamp(props.time.toISOString())
    });

    // Forward the event to the output SNS topic.
    const publishStep = new tasks.SnsPublish(this, 'PublishStep', {
      topic: this.eventBus,
      message: sfn.TaskInput.fromJsonPathAt('$.data')
    });

    // The state machine definition.
    const definition = delayStep.next(publishStep);

    // The state machine orchestrating the delay step.
    const stateMachine = new sfn.StateMachine(this, 'StateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      tracingEnabled: true,
      comment: 'A state machine orchestrating a delay.',
      stateMachineType: sfn.StateMachineType.STANDARD
    });

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.eventProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'A function starting a step-function to delay the processing.',
      entry: path.resolve(__dirname, 'lambdas', 'delay', 'index.js'),
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
        STATE_MACHINE_ARN: stateMachine.stateMachineArn
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-sfn'
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
    stateMachine.grantStartExecution(this.eventProcessor);

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

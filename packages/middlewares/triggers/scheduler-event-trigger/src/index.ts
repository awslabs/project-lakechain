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
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as scheduler from '@aws-cdk/aws-scheduler-alpha';
import * as targets from '@aws-cdk/aws-scheduler-targets-alpha';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { CacheStorage } from '@project-lakechain/core';
import { SchedulerEventTriggerProps, SchedulerEventTriggerPropsSchema } from './definitions/opts';
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
  name: 'scheduler-event-trigger',
  description: 'An event-based trigger based on configured schedules.',
  version: '0.3.4',
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
const DEFAULT_MEMORY_SIZE = 192;

/**
 * Builder for the `SchedulerEventTrigger` middleware.
 */
class SchedulerEventTriggerBuilder extends MiddlewareBuilder {
  private triggerProps: Partial<SchedulerEventTriggerProps> = {};

  /**
   * Specifies the schedule expression that triggers the pipeline.
   * @param scheduleExpression the schedule expression to use.
   * @returns the builder instance.
   */
  public withSchedule(scheduleExpression: scheduler.ScheduleExpression) {
    this.triggerProps.scheduleExpression = scheduleExpression;
    return (this);
  }

  /**
   * Sets the documents to inject in the pipeline.
   * @param documents an array of document URIs.
   * @returns the builder instance.
   */
  public withDocuments(documents: string[]) {
    this.triggerProps.documents = documents;
    return (this);
  }

  /**
   * @returns a new instance of the `SchedulerEventTrigger`
   * service constructed with the given parameters.
   */
  public build(): SchedulerEventTrigger {
    return (new SchedulerEventTrigger(
      this.scope,
      this.identifier, {
        ...this.triggerProps as SchedulerEventTriggerProps,
        ...this.props
      }
    ));
  }
}

/**
 * A component that triggers a pipeline based on AWS EventBridge
 * Scheduler schedules.
 */
export class SchedulerEventTrigger extends Middleware {

  /**
   * The internal middleware storage.
   */
  public storage: CacheStorage;

  /**
   * The event processing lambda function.
   */
  public eventProcessor: lambda.IFunction;

  /**
   * The builder for the `SchedulerEventTrigger` service.
   */
  static Builder = SchedulerEventTriggerBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: SchedulerEventTriggerProps) {
    super(scope, id, description, props);

    // Validating the properties.
    this.props = this.parse(SchedulerEventTriggerPropsSchema, props);

    ///////////////////////////////////////////
    /////////    Processing Storage      //////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: this.props.kmsKey
    });

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.eventProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'Translates scheduler events into CloudEvents.',
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
        SNS_TARGET_TOPIC: this.eventBus.topicArn,
        STORAGE_BUCKET: this.storage.id(),
        DOCUMENT_URIS: JSON.stringify(this.props.documents)
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

    // Creating the schedule using the provided schedule
    // expression.
    new scheduler.Schedule(this, 'Schedule', {
      description: 'Triggers a pipeline based on the configured schedule.',
      schedule: this.props.scheduleExpression,
      target: new targets.LambdaInvoke(this.eventProcessor, {})
    });

    // Function permissions.
    this.eventBus.grantPublish(this.eventProcessor);

    ///////////////////////////////////////////
    /////   Placeholder Document Upload   /////
    ///////////////////////////////////////////

    // Upload the placeholder document in the internal storage.
    const uris = new s3deploy.BucketDeployment(this, 'Uris', {
      sources: [s3deploy.Source.jsonData('placeholder.json', '{}')],
      destinationBucket: this.storage.getBucket()
    });

    // Ensure that the event processor is deployed.
    uris.node.addDependency(this.eventProcessor);

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
    return ([]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   * @note when specifying documents to the Scheduler,
   * it will attempt to infer the mime-types associated
   * with these documents. If no documents are specified,
   * the Scheduler will send a placeholder document to the
   * next middlewares having a mime-type of `application/json+scheduler`.
   */
  supportedOutputTypes(): string[] {
    return ([
      this.props.documents.length > 0 ?
        '*/*' :
        'application/json+scheduler'
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

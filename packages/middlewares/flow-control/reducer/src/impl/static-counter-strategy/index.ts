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
 * WITHOUT WARRANTIES OR ReducerS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

import { Construct } from 'constructs';
import { ReducerProps } from '../../definitions/opts';
import { Reducer } from '../..';

import {
  LAMBDA_INSIGHTS_VERSION,
  NAMESPACE
} from '@project-lakechain/core/middleware';

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME = lambda.Runtime.NODEJS_18_X;

/**
 * An implementation of a reducer strategy counting the number of events
 * produced to define when to reduce them.
 */
export class StaticCounterStrategyConstruct extends Construct {

  /**
   * The insertion processor lambda function.
   */
  public insertionProcessor: lambda.IFunction;

  /**
   * The de-duplication function.
   */
  public deduplicationFn: lambda.IFunction;

  /**
   * The counter function.
   */
  public counterFn: lambda.IFunction;

  /**
   * The reducer function.
   */
  public reducerFn: lambda.IFunction;

  /**
   * The de-duplication queue.
   */
  public deduplicationQueue: sqs.Queue;

  /**
   * The table that contains received events.
   */
  public table: dynamodb.Table;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, reducer: Reducer, props: ReducerProps) {
    super(scope, id);

    // Reducer middleware properties.
    const queue = reducer.getQueue();
    const eventBus = reducer.getEventBus();
    const logGroup = reducer.getLogGroup();
    const eventCount = props.strategy.compile().eventCount;

    ///////////////////////////////////////////
    ///////       Event Storage         ///////
    ///////////////////////////////////////////

    this.table = new dynamodb.Table(this, 'Table', {
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'sk',
        type: dynamodb.AttributeType.STRING
      },
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryptionKey: props.kmsKey
    });

    ///////////////////////////////////////////
    ///////    De-duplication Queue     ///////
    ///////////////////////////////////////////

    // The SQS FIFO queue used to de-duplicate the events.
    this.deduplicationQueue = new sqs.Queue(this, 'DeduplicationQueue', {
      fifo: true,
      contentBasedDeduplication: true,
      encryptionMasterKey: props.kmsKey,
      encryption: props.kmsKey ?
        sqs.QueueEncryption.KMS :
        sqs.QueueEncryption.SQS_MANAGED,
      visibilityTimeout: props.queueVisibilityTimeout,
      enforceSSL: true
    });

    ///////////////////////////////////////////
    //////   De-duplication Function     //////
    ///////////////////////////////////////////

    this.deduplicationFn = new node.NodejsFunction(this, 'Deduplication', {
      description: 'A function used to insert events in the de-duplication queue.',
      entry: path.resolve(__dirname, 'lambdas', 'deduplication', 'index.js'),
      vpc: props.vpc,
      timeout: cdk.Duration.seconds(10),
      runtime: EXECUTION_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: props.kmsKey,
      logGroup,
      insightsVersion: props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      environment: {
        POWERTOOLS_SERVICE_NAME: reducer.name(),
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        SQS_DEDUPLICATION_QUEUE_URL: this.deduplicationQueue.queueUrl
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-sqs'
        ]
      }
    });

    // Allows the reducer to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    reducer.grantPrincipal = this.deduplicationFn.grantPrincipal;

    // Allow the function to consume messages from the input queue.
    queue.grantConsumeMessages(this.deduplicationFn);

    // Allow the function to send messages to the de-duplication queue.
    this.deduplicationQueue.grantSendMessages(this.deduplicationFn);

    // Plug the SQS queue into the deduplication function.
    this.deduplicationFn.addEventSource(new sources.SqsEventSource(queue, {
      batchSize: 1,
      maxBatchingWindow: props.batchingWindow
    }));

    ///////////////////////////////////////////
    ///////     Insertion Function      ///////
    ///////////////////////////////////////////

    this.insertionProcessor = new node.NodejsFunction(this, 'Compute', {
      description: 'A function inserting events in DynamoDB.',
      entry: path.resolve(__dirname, 'lambdas', 'insertion', 'index.js'),
      vpc: props.vpc,
      timeout: cdk.Duration.seconds(10),
      runtime: EXECUTION_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: props.kmsKey,
      logGroup,
      insightsVersion: props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      environment: {
        POWERTOOLS_SERVICE_NAME: reducer.name(),
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        TABLE_NAME: this.table.tableName
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-dynamodb'
        ]
      }
    });

    // Plug the SQS queue into the lambda function.
    this.insertionProcessor.addEventSource(new sources.SqsEventSource(this.deduplicationQueue, {
      batchSize: 10
    }));

    // Allow the function to insert items in the DynamoDB table.
    this.table.grantWriteData(this.insertionProcessor);

    ///////////////////////////////////////////
    ///////      Counter Function        //////
    ///////////////////////////////////////////

    this.counterFn = new node.NodejsFunction(this, 'Counter', {
      description: 'A function counting the number of events for a chain identifier.',
      entry: path.resolve(__dirname, 'lambdas', 'counter', 'index.js'),
      vpc: props.vpc,
      timeout: cdk.Duration.seconds(10),
      runtime: EXECUTION_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: props.kmsKey,
      logGroup,
      insightsVersion: props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      environment: {
        POWERTOOLS_SERVICE_NAME: reducer.name(),
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        TABLE_NAME: this.table.tableName
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-dynamodb'
        ]
      }
    });

    // Function permissions.
    this.table.grantWriteData(this.counterFn);

    // Plug the DynamoDB stream into the lambda function.
    this.counterFn.addEventSource(new sources.DynamoEventSource(this.table, {
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 1,
      parallelizationFactor: 10,
      retryAttempts: props.maxRetry,
      filters: [
        lambda.FilterCriteria.filter({
          eventName: lambda.FilterRule.isEqual('INSERT'),
          dynamodb: {
            Keys: {
              sk: {
                S: lambda.FilterRule.beginsWith('EVENT##')
              }
            }
          }
        })
      ]
    }));

    ///////////////////////////////////////////
    ///////      Reducer Function        //////
    ///////////////////////////////////////////

    this.reducerFn = new node.NodejsFunction(this, 'Reducer', {
      description: 'A function reducing events.',
      entry: path.resolve(__dirname, 'lambdas', 'reducer', 'index.js'),
      vpc: props.vpc,
      timeout: cdk.Duration.seconds(30),
      runtime: EXECUTION_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: props.kmsKey,
      logGroup,
      insightsVersion: props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      environment: {
        POWERTOOLS_SERVICE_NAME: reducer.name(),
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        SNS_TARGET_TOPIC: eventBus.topicArn,
        PROCESSED_FILES_BUCKET: reducer.storage.id(),
        TABLE_NAME: this.table.tableName
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-s3',
          '@aws-sdk/client-sns'
        ]
      }
    });

    // Function permissions.
    this.table.grantReadWriteData(this.reducerFn);
    reducer.storage.grantWrite(this.reducerFn);
    eventBus.grantPublish(this.reducerFn);

    // Plug the DynamoDB stream into the lambda function with a filter
    // that evaluates the counter value to trigger the reduction.
    this.reducerFn.addEventSource(new sources.DynamoEventSource(this.table, {
      startingPosition: lambda.StartingPosition.LATEST,
      batchSize: 1,
      parallelizationFactor: 1,
      retryAttempts: props.maxRetry,
      filters: [
        lambda.FilterCriteria.filter({
          eventName: lambda.FilterRule.notEquals('REMOVE'),
          dynamodb: {
            Keys: {
              sk: {
                S: lambda.FilterRule.isEqual('COUNTER')
              }
            },
            NewImage: {
              count: {
                N: lambda.FilterRule.isEqual(eventCount)
              }
            }
          }
        })
      ]
    }));
  }
}

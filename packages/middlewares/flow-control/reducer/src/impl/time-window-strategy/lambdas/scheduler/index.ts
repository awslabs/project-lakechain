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

import { randomUUID } from 'crypto';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { SchedulerClient, CreateScheduleCommand } from '@aws-sdk/client-scheduler';
import { Context, DynamoDBRecord } from 'aws-lambda';

import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const REDUCER_STRATEGY = JSON.parse(process.env.REDUCER_STRATEGY as string);

/**
 * The EventBridge Scheduler client.
 */
const scheduler = tracer.captureAWSv3Client(new SchedulerClient({
  region: process.env.AWS_REGION,
  maxAttempts: 3
}));

/**
 * The async batch processor processes the received
 * events from DynamoDB in parallel.
 */
const processor = new BatchProcessor(EventType.DynamoDBStreams);

/**
 * A helper function that generates a date representing the next time
 * an event should be scheduled. It generates that time based on the
 * given `offset` and adds a random delta to it between 0 and `maxDelta`.
 * @param offset the time offset in seconds to wait before scheduling
 * the reduce function.
 * @param jitter a jitter value in seconds to apply to the offset.
 * @returns the date at which the next event should be scheduled.
 */
const getNextTime = (
  offset = REDUCER_STRATEGY.timeWindow,
  jitter = REDUCER_STRATEGY.jitter ?? 0
) => {
  const value = (offset + Math.floor(Math.random() * jitter)) * 1000;
  return (new Date(Date.now() + value)
    .toISOString()
    .substring(0, 19)
  );
};

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * Creates a new schedule to run the reducer function
   * in response to a new pending status created for a
   * specific `chainId` in DynamoDB.
   * @param record the DynamoDB record to process.
   */
  async processRecord(record: DynamoDBRecord) {
    const chainId = record.dynamodb?.NewImage?.pk?.S;

    if (chainId) {
      await scheduler.send(new CreateScheduleCommand({
        Name: randomUUID(),
        ScheduleExpression: `at(${getNextTime()})`,
        ActionAfterCompletion: 'DELETE',
        FlexibleTimeWindow: {
          Mode: 'OFF'
        },
        Target: {
          RoleArn: process.env.INVOCATION_ROLE_ARN,
          Arn: process.env.REDUCER_FUNCTION_ARN,
          Input: JSON.stringify({ chainId })
        }
      }));
    }
  }

  /**
   * The Lambda entry point.
   * @param event the received DynamoDB stream event.
   * @param _ the Lambda context.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: any, _: Context): Promise<any> {
    return (await processPartialResponse(event, this.processRecord.bind(this), processor));
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);

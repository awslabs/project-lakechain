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

import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { SQSEvent, Context } from 'aws-lambda';
import { randomUUID } from 'crypto';
import {
  DynamoDBClient,
  BatchWriteItemCommand
} from '@aws-sdk/client-dynamodb';

/**
 * Environment variables.
 */
const TABLE_NAME = process.env.TABLE_NAME as string;

/**
 * The DynamoDB client.
 */
const dynamoDb = tracer.captureAWSv3Client(new DynamoDBClient({
  region: process.env.AWS_REGION,
  maxAttempts: 3
}));

/**
 * This method computes the time-to-live value for events stored in DynamoDB.
 * The purpose is to ensure that elements within the table are automatically
 * deleted after a certain amount of time.
 * @returns a time-to-live value for events stored in DynamoDB.
 * @default 48 hours.
 */
const getTtl = () => {
  const SECONDS_IN_AN_HOUR = 60 * 60;
  return (Math.round(Date.now() / 1000) + (48 * SECONDS_IN_AN_HOUR));
};

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * The Lambda entry point.
   * @param event the received SQS event.
   * @param _ the Lambda context.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: SQSEvent, _: Context): Promise<any> {
    try {
      await dynamoDb.send(new BatchWriteItemCommand({
        RequestItems: {
          [TABLE_NAME]: event.Records.map((record) => {
            const event = CloudEvent.from(record.body);
            const uuid  = randomUUID();
            return ({
              PutRequest: {
                Item: {
                  pk: { S: event.data().chainId() },
                  sk: { S: `EVENT##${new Date().toISOString()}##${uuid}` },
                  type: { S: 'event' },
                  event: { S: JSON.stringify(event) },
                  ttl: { N: getTtl().toString() }
                }
              }
            })
          })
        }
      }));
    } catch (error) {
      logger.error(error as any);
      throw error;
    }
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);

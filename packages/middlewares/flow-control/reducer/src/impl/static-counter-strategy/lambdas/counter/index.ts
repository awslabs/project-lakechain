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
import { Context, DynamoDBStreamEvent } from 'aws-lambda';
import { CloudEvent } from '@project-lakechain/sdk/models';

import {
  DynamoDBClient,
  UpdateItemCommand
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
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * The Lambda entry point.
   * @param event the received DynamoDB event.
   * @param _ the Lambda context.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: DynamoDBStreamEvent, _: Context): Promise<any> {
    try {
      const e = CloudEvent.from(event.Records[0].dynamodb!.NewImage!.event.S!);

      // Increment the event counter atomically.
      await dynamoDb.send(new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: { S: e.data().chainId() },
          sk: { S: 'COUNTER' }
        },
        UpdateExpression: `
          SET #count = if_not_exists(#count, :initialValue) + :inc
        `,
        ExpressionAttributeNames: {
          '#count': 'count'
        },
        ExpressionAttributeValues: {
          ':initialValue': {
            N: '0'
          },
          ':inc': {
            N: '1'
          }
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

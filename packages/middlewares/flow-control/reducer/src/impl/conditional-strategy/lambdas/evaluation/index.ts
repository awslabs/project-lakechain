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
import { evaluate } from './evaluate';

import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
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
   * Fetches all the events associated with the given `chainId`
   * and returns them as an array of `CloudEvent`.
   * @param chainId the chain identifier.
   * @returns an array of `CloudEvent`.
   */
  private async getAggregatedEvents(chainId: string) {
    const results = await dynamoDb.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
      ConsistentRead: true,
      ExpressionAttributeNames: {
        '#pk': 'pk',
        '#sk': 'sk'
      },
      ExpressionAttributeValues: {
        ':pk': { S: chainId },
        ':prefix': { S: 'EVENT##' }
      }
    }));

    return ((results.Items || []).map((item) => {
      return (CloudEvent.from(JSON.parse(item.event.S as string)));
    }));
  }

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

      // Retrieve all the events stored in the table.
      const events = await this.getAggregatedEvents(e.data().chainId());

      // Evaluate the conditional expression.
      let result: boolean;
      try {
        result = await evaluate(e, events);
      } catch (error) {
        logger.error(error as any);
        result = false;
      }

      if (result) {
        // Set the state of the aggregation to `processed` if it
        // is not already set. This is to indicate that the reduce
        // operation can be triggered, and to ensure that it only
        // happens once.
        try {
          await dynamoDb.send(new UpdateItemCommand({
            TableName: TABLE_NAME,
            Key: {
              pk: { S: e.data().chainId() },
              sk: { S: 'STATUS' }
            },
            UpdateExpression: `
              SET #status = :status
            `,
            ConditionExpression: 'attribute_not_exists(#status) OR #status <> :status',
            ExpressionAttributeNames: {
              '#status': 'status'
            },
            ExpressionAttributeValues: {
              ':status': { S: 'processed' }
            }
          }));
        } catch (error) {
          // This might indicate that we received events after
          // the aggregation has been processed.
          logger.error(error as any);
        }
      }
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

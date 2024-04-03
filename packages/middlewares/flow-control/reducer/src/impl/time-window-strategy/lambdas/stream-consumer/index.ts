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

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { Context } from 'aws-lambda';

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
 * Group an array of elements by a given key.
 * @param arr the array to group.
 * @param key the key to group by.
 * @returns a record mapping the given key to the
 * elements of the array.
 */
const groupBy = <T, K extends keyof any>(arr: T[], key: (i: T) => K) =>
  arr.reduce((groups, item) => {
    (groups[key(item)] ||= []).push(item);
    return groups;
  }, {} as Record<K, T[]>
);

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * The Lambda entry point.
   * @param event the received DynamoDB stream event.
   * @param _ the Lambda context.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: any, _: Context): Promise<any> {
    try {
      // Group all records by `chainId`.
      const records = groupBy(event.Records, (record: any) => {
        return (CloudEvent
          .from(record.dynamodb.NewImage.event.S)
          .data()
          .chainId()
        );
      });

      // For each `chainId` create a new entry with a sort key of `STATUS`
      // if does not exist. We ignore the error if the sort key for that
      // `chainId` already exists.
      for (const chainId in records) {
        try {
          await dynamoDb.send(new PutItemCommand({
            TableName: TABLE_NAME,
            Item: {
              pk: { S: chainId },
              sk: { S: 'STATUS' },
              type: { S: 'status' },
              status: { S: 'pending' }
            },
            ConditionExpression: 'attribute_not_exists(sk)'
          }));
        } catch (error: any) {
          if (error.name !== 'ConditionalCheckFailedException') {
            // A status already exists for this partition key.
            throw error;
          }
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

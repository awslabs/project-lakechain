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
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { next } from '@project-lakechain/sdk/decorators';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { Context } from 'aws-lambda';

import {
  DynamoDBClient,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import {
  CloudEvent,
  EventType,
  DataEnvelope,
  Document
} from '@project-lakechain/sdk/models';

/**
 * Environment variables.
 */
const TABLE_NAME = process.env.TABLE_NAME as string;
const TARGET_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;
const COUNTER_THRESHOLD = parseInt(process.env.COUNTER_THRESHOLD as string);

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
   * Creates an aggregated cloud event containing the reduced events.
   * @param chainId the chain identifier of the events.
   * @param events an array of events to reduce.
   * @returns a promise with the new aggregated cloud event.
   */
  @next()
  async reduceEvents(chainId: string, events: CloudEvent[]): Promise<CloudEvent> {
    const data = Buffer.from(JSON.stringify(events));
    const key  = `${chainId}/${randomUUID()}.json`;
    const type = 'application/cloudevents+json';

    // The URL of the new document.
    const url = new S3DocumentDescriptor.Builder()
      .withBucket(TARGET_BUCKET)
      .withKey(key)
      .build()
      .asUri();
    
    // Create a new document.
    const document = await Document.create({ url, type, data });

    // Create a new cloud event for the reduced event.
    return (new CloudEvent.Builder()
      .withType(EventType.DOCUMENT_CREATED)
      .withData(new DataEnvelope.Builder()
        .withChainId(chainId)
        .withSourceDocument(events[0].data().source())
        .withDocument(document)
        .withMetadata({})
        .build()
      ).build()
    );
  }

  /**
   * The Lambda entry point.
   * @param event the received scheduled event.
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

      // For each `chainId` we want to query the number of events
      // currently stored in the table. If the number of events
      // is equal or greater than the given threshold, we reduce
      // the events.
      for (const chainId in records) {
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

        if (results.Count && results.Count >= COUNTER_THRESHOLD) {
          await this.reduceEvents(chainId, results.Items?.map((item) => {
            return (CloudEvent.from(JSON.parse(item.event.S as string)));
          }) ?? []);
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

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
  PutItemCommand
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
      // Retrieve all events matching the `chainId`, and where
      // the sort key starts with `EVENT##`.
      const results = await dynamoDb.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :prefix)',
        ExpressionAttributeNames: {
          '#pk': 'pk',
          '#sk': 'sk'
        },
        ExpressionAttributeValues: {
          ':pk': { S: event.chainId },
          ':prefix': { S: 'EVENT##' }
        }
      }));

      // Parse the events and reduce them in a single event.
      const events = results.Items?.map((item) => {
        return (CloudEvent.from(JSON.parse(item.event.S as string)));
      });
      if (events && events?.length > 0) {
        await this.reduceEvents(event.chainId, events);
      }

      // Set the status to `processed` for the given `chainId`.
      await dynamoDb.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: { S: event.chainId },
          sk: { S: 'STATUS' },
          type: { S: 'status' },
          status: { S: 'processed' },
          ttl: { N: getTtl().toString() }
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

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
import { CloudEvent } from '@project-lakechain/sdk/models';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { SQSEvent, Context } from 'aws-lambda';

/**
 * The SQS client.
 */
const sqs = tracer.captureAWSv3Client(new SQSClient({
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
   * @param event the received SQS event.
   * @param _ the Lambda context.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: SQSEvent, _: Context): Promise<any> {
    try {
      const events = event.Records.map((record) => {
        return (CloudEvent.from(record.body));
      });
      
      // Forward the received batch of events to the deduplication queue.
      await sqs.send(new SendMessageBatchCommand({
        QueueUrl: process.env.SQS_DEDUPLICATION_QUEUE_URL,
        Entries: events.map((event) => {
          return ({
            Id: randomUUID(),
            MessageBody: JSON.stringify(event),
            MessageGroupId: event.data().chainId()
          });
        })
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

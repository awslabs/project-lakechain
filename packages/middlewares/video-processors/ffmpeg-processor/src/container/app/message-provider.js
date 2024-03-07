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

import { CloudEvent } from '@project-lakechain/sdk/models';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from '@aws-sdk/client-sqs';

/**
 * The SQS client.
 */
const sqs = new SQSClient({
  region: process.env.AWS_REGION,
  maxAttempts: 3
});

const getEvents  = (message) => {
  const event    = CloudEvent.from(message.Body);
  const document = event.data().document();

  if (document.type() === 'application/cloudevents+json') {
    const data = JSON.parse(document.data().asBuffer());
    return (data.map((event) => CloudEvent.from(event)));
  } else {
    return ([event]);
  }
};

/**
 * Polls document from the given SQS queue sequentially.
 * @param {*} queueUrl the URL of the SQS queue.
 * @returns a promise to an object containing the cloud event,
 * the SQS message receipt handle, and a delete function to remove
 * the message from the queue. If no message is available,
 * the function returns a promise that resolves to null.
 */
export const pollDocuments = async (queueUrl) => {
  const { Messages } = await sqs.send(new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20
  }));

  if (Messages && Messages.length > 0) {
    return ({
      events: getEvents(Messages[0]),
      receiptHandle: Messages[0].ReceiptHandle,
      delete: async () => {
        await sqs.send(new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: Messages[0].ReceiptHandle
        }));
      }
    });
  }
  return (null);
};

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

import { SQSEvent, SQSRecord, Context, SQSBatchResponse } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { TranscribeClient, StartTranscriptionJobCommand } from '@aws-sdk/client-transcribe';

import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const TRANSCRIBE_OPTS = JSON.parse(process.env.TRANSCRIBE_OPTS ?? '{}');

/**
 * The DynamoDB client.
 */
const dynamodb = tracer.captureAWSv3Client(new DynamoDBClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * The transcribe client.
 */
const transcribe = tracer.captureAWSv3Client(new TranscribeClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * The async batch processor processes the received
 * events from SQS in parallel.
 */
const processor = new BatchProcessor(EventType.SQS);

/**
 * This method computes the time-to-live value for events stored in DynamoDB.
 * The purpose is to ensure that elements within the table are automatically
 * deleted after a certain amount of time.
 * @returns a time-to-live value for events stored in DynamoDB.
 * @default 24 hours.
 */
const getTtl = () => {
  const SECONDS_IN_AN_HOUR = 60 * 60;
  return (Math.round(Date.now() / 1000) + (24 * SECONDS_IN_AN_HOUR));
};

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * This method processes the received event and stores
   * it in DynamoDB for further processing.
   * @param event the event to process.
   */
  async processEvent(event: CloudEvent): Promise<any> {
    const document = event.data().document();
    const chainId  = event.data().chainId();
    const jobId    = `${chainId}-${document.etag()}`;
    const ttl      = getTtl();

    // Create the transcription job.
    await transcribe.send(new StartTranscriptionJobCommand({
      TranscriptionJobName: jobId,
      Media: {
        MediaFileUri: decodeURIComponent(
          document.url().toString()
        )
      },
      ...TRANSCRIBE_OPTS
    }));

    // Create a new entry in DynamoDB.
    return (await dynamodb.send(new PutItemCommand({
      TableName: process.env.MAPPING_TABLE,
      Item: {
        // We compute a transcription identifier based on the
        // document etag and the chain identifier. This will uniquely
        // identify the transcription for this specific document.
        TranscriptionJobId: { S: jobId },
        // The document event is serialized in the table as well, to
        // keep an association between the document and the transcription.
        event: { S: JSON.stringify(event) },
        // Every entry in the table has a time-to-live value that
        // is used to automatically delete entries after a certain
        // amount of time.
        ttl: { N: ttl.toString() }
      }
    })));
  }

  /**
   * The Lambda entry point.
   * @param event the received SQS event.
   * @param _ the Lambda context.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: SQSEvent, _: Context): Promise<SQSBatchResponse> {
    return (await processPartialResponse(
      event,
      (record: SQSRecord) => this.processEvent(
        CloudEvent.from(JSON.parse(record.body))
      ),
      processor
    ));
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);

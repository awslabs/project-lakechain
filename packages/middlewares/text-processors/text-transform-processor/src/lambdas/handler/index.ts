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

import { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { next } from '@project-lakechain/sdk/decorators';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { IntentHandler } from './transformation/index.js';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const TARGET_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;
const ops = JSON.parse(process.env.INTENT ?? '[]');
if (!Array.isArray(ops) || !ops.length) {
  throw new Error('No operations to apply.');
}

/**
 * The S3 client.
 */
const s3 = tracer.captureAWSv3Client(new S3Client({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * The async batch processor processes the received
 * events from SQS in parallel.
 */
const processor = new BatchProcessor(EventType.SQS);

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * @param event the event to process.
   * @note the next decorator will automatically forward the
   * returned cloud event to the next middlewares
   */
  @next()
  async processEvent(event: CloudEvent): Promise<CloudEvent> {
    const document  = event.data().document();
    const chainId   = event.data().chainId();
    const handler   = new IntentHandler(ops);
    const outputKey = `${chainId}/${document.filename().basename()}`;

    // We apply the transformations on the text.
    const transformedText = await handler.transform(event);

    // Upload the text as a new document.
    const res = await s3.send(new PutObjectCommand({
      Bucket: TARGET_BUCKET,
      Key: outputKey,
      Body: transformedText,
      ContentType: document.mimeType()
    }));

    // Update the event.
    document.props.url  = new S3DocumentDescriptor.Builder()
      .withBucket(TARGET_BUCKET)
      .withKey(outputKey)
      .build()
      .asUri();
    document.props.type = document.mimeType();
    document.props.size = Buffer.from(transformedText, 'utf-8').byteLength;
    document.props.etag = res.ETag?.replace(/"/g, '');

    return (event);
  }

  /**
   * The Lambda entry point.
   * @param event the received SQS event.
   * @param _ the Lambda context.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: SQSEvent, _: Context) {
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

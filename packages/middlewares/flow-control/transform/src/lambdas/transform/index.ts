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
import { nextAsync } from '@project-lakechain/sdk/decorators';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { evaluate } from './evaluate';

import {
  SQSEvent,
  SQSRecord,
  Context,
  SQSBatchResponse
} from 'aws-lambda';
import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const TARGET_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;

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

  async aggregate(events: CloudEvent[], originalEvent: CloudEvent): Promise<CloudEvent> {
    const output = JSON.stringify(events);
    const originalDoc = originalEvent.data().document();
    const key = `processed/${originalDoc.etag()}.json`;

    // Upload the new event.
    const res = await s3.send(new PutObjectCommand({
      Bucket: TARGET_BUCKET,
      Key: key,
      Body: output,
      ContentType: originalDoc.mimeType()
    }));

    // Update the original event with the new document.
    originalEvent.data().document().props = {
      ...originalDoc.props,
      url: new S3DocumentDescriptor({
        bucket: TARGET_BUCKET,
        key
      }).asUri(),
      type: originalDoc.mimeType(),
      size: output.length,
      etag: res.ETag?.replace(/"/g, '')
    };

    return (originalEvent);
  }

  /**
   * Evaluates the transform expression with the
   * given input events.
   * @param events the input events to transform.
   * @param originalEvent the original event that triggered the transformation.
   * @returns a promise with the transformed events.
   * @throws if the condition cannot be evaluated.
   */
  async processEvents(events: CloudEvent[], originalEvent: CloudEvent) {    
    const results = await evaluate(events);

    if (originalEvent.data().document().mimeType() === 'application/cloudevents+json') {
      if (Array.isArray(results)) {
        await nextAsync(
          await this.aggregate(results, originalEvent)
        );
      } else {
        await nextAsync(results);
      }
    } else {
      // If the event is not aggregated, we publish the results produced
      // by the transform expression to the next middlewares.
      if (Array.isArray(results)) {
        for (const event of results) {
          await nextAsync(event);
        }
      } else {
        await nextAsync(results);
      }
    }
  }

  /**
   * Handles the given input event. If the event is an aggregated
   * event, it will be parsed into individual events and passed
   * to the `processEvents` method.
   * @param event the input event to process.
   * @returns a promise with the processed event.
   */
  async processEvent(event: CloudEvent) {
    const document = event.data().document();
    let events: CloudEvent[] = [];

    if (document.mimeType() === 'application/cloudevents+json') {
      const data = JSON.parse((await document
        .data()
        .asBuffer())
        .toString('utf-8')
      );
      events = data.map((event: string) => CloudEvent.from(event));
    } else {
      events = [event];
    }

    return (this.processEvents(events, event));
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

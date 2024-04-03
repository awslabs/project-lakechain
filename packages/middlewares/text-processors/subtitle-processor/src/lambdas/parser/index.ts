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
import { CloudEvent, Document } from '@project-lakechain/sdk/models';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { vttToText, vttToJson } from './vtt';
import { srtToText, srtToJson } from './srt';

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
import { nextAsync } from '@project-lakechain/sdk/decorators';

/**
 * Environment variables.
 */
const TARGET_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;
const OUTPUT_FORMATS = JSON.parse(process.env.OUTPUT_FORMATS ?? '[]');

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
   * Creates a new event for the specified output format.
   * @param text the text associated with the new document.
   * @param type the mime type of the new document.
   * @param event the original event.
   * @returns a new cloud event with the processed document.
   */
  async createEvent(text: string, type: string, event: CloudEvent): Promise<CloudEvent> {
    const cloned  = event.clone();
    const chainId = cloned.data().chainId();

    // Determine the extension based on the mime type.
    const ext = type === 'text/plain' ? 'txt' : 'json';

    // Create a new document with the processed text.
    cloned.data().props.document = await Document.create({
      url: new S3DocumentDescriptor.Builder()
        .withBucket(TARGET_BUCKET)
        .withKey(`${chainId}/${cloned.data().document().etag()}.${ext}`)
        .build()
        .asUri(),
      type,
      data: Buffer.from(text, 'utf-8')
    });

    return (cloned);
  }

  /**
   * @param event the event to process.
   * @note the next decorator will automatically forward the
   * returned cloud event to the next middlewares
   */
  async processEvent(event: CloudEvent): Promise<CloudEvent> {
    const document = event.data().document();

    // We load the subtitle document in memory.
    const text = (await document.data().asBuffer()).toString('utf-8');

    // For each specified output formats, we create a new document
    // and forward it to the next middlewares.
    for (const format of OUTPUT_FORMATS) {
      let result: CloudEvent;

      // VTT.
      if (document.mimeType() === 'text/vtt') {
        if (format === 'text') {
          result = await this.createEvent(vttToText(text), 'text/plain', event);
        } else if (format === 'json') {
          result = await this.createEvent(vttToJson(text), 'application/json', event);
        }

      // SRT.
      } else if (document.mimeType() === 'application/x-subrip') {
        if (format === 'text') {
          result = await this.createEvent(srtToText(text), 'text/plain', event);
        } else if (format === 'json') {
          result = await this.createEvent(srtToJson(text), 'application/json', event);
        }
      }

      // Forward the new event to the next middlewares.
      await nextAsync(result!);
    }

    return (event);
  }

  /**
   * The Lambda entry point.
   * @param event the received SQS event.
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
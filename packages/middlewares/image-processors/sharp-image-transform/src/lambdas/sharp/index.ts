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

import merge from 'lodash/merge';

import { randomUUID } from 'crypto';
import { SQSEvent, SQSRecord, Context, SQSBatchResponse } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent, Document } from '@project-lakechain/sdk/models';
import { nextAsync } from '@project-lakechain/sdk/decorators';
import { processExpression } from './expression';
import { processFunclet } from './funclet';
import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const PROCESSED_FILES_BUCKET = process.env.PROCESSED_FILES_BUCKET;

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
  async processEvent(event: CloudEvent): Promise<CloudEvent> {
    const results = process.env.OPS_TYPE === 'expression' ?
      processExpression(event) :
      processFunclet(event);

    // For each yielded image, we create a new document.
    for await (const result of results) {
      const key = `${event.data().chainId()}/${randomUUID()}.${result.ext}`;

      // Create a new document with the processed image.
      event.data().props.document = await Document.create({
        url: new URL(`s3://${PROCESSED_FILES_BUCKET}/${key}`),
        data: result.buffer,
        type: result.type
      });

      // We set the image metadata as the document metadata.
      merge(event.data().props.metadata, result.metadata);

      // Forward the event to the next middlewares.
      await nextAsync(event);
    }

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

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

import crypto from 'crypto';
import merge from 'lodash/merge.js';

import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent, Document, DocumentMetadata } from '@project-lakechain/sdk/models';
import { next } from '@project-lakechain/sdk/decorators';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';

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
const SEPARATOR_TYPE = process.env.SEPARATOR_TYPE as string;
const SEPARATOR = process.env.SEPARATOR as string;
const TARGET_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;

/**
 * The async batch processor processes the received
 * events from SQS in parallel.
 */
const processor = new BatchProcessor(EventType.SQS);

/**
 * Splits the given text into an array of substrings
 * based on the specified separator.
 * @param text the text to split.
 * @returns an array of substrings.
 */
const splitText = (text: string): string[] => {
  let separator: any = SEPARATOR;

  // If the separator is a regexp, we deserialize the regexp expression.
  if (SEPARATOR_TYPE === 'regexp') {
    separator = new RegExp(
      SEPARATOR.slice(1, SEPARATOR.lastIndexOf('/')),
      SEPARATOR.slice(SEPARATOR.lastIndexOf('/') + 1)
    );
  }

  return (text
    .split(separator)
    .map((t) => t.trim())
  );
};

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * @param chunk the chunk of text to return
   * metadata for.
   * @param order the order of the chunk.
   * @returns the metadata for the chunk.
   */
  getMetadata(chunk: string, order: number): DocumentMetadata {
    return ({
      properties: {
        kind: 'text',
        attrs: {
          chunk: {
            id: crypto
              .createHash('sha256')
              .update(chunk)
              .digest('hex'),
            order
          }
        }
      }
    });
  }

  /**
   * Called back for each chunk of text. This method
   * publishes the chunk as a separate document to the
   * next middlewares, while preserving the original
   * chain execution identifier.
   * @param chunk the chunk to publish.
   * @param order the order in which the chunk appears
   * in the original document.
   * @param source the event associated with the original
   * document.
   * @returns a promise resolving the updated event.
   */
  @next()
  async onChunk(chunk: string, order: number, source: CloudEvent): Promise<any> {
    const event     = source.clone();
    const document  = event.data().document();
    const chainId   = event.data().chainId();
    const outputKey = `${chainId}/regexp-text-splitter-${document.etag()}-${order}.txt`;

    // Create a new document for the chunk.
    event.data().props.document = await Document.create({
      url: new S3DocumentDescriptor({
        bucket: TARGET_BUCKET,
        key: outputKey
      }).asUri(),
      type: 'text/plain',
      data: Buffer.from(chunk, 'utf-8')
    });

    // Update the metadata.
    merge(event.data().props.metadata, this.getMetadata(chunk, order));

    return (event);
  }

  /**
   * @param event the event to process.
   * @note the next decorator will automatically forward the
   * returned cloud event to the next middlewares
   */
  async processEvent(event: CloudEvent): Promise<CloudEvent> {
    const document = event.data().document();

    // We load the text file in memory.
    const text = (await document.data().asBuffer()).toString('utf-8');

    // Split the text into chunks.
    const chunks = splitText(text);

    // Publish each chunk as a separate document.
    for (const [idx, chunk] of chunks.entries()) {
      await this.onChunk(chunk, idx, event);
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
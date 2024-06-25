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
import { getDocument, getMetadata } from './get-document';
import { ObjectNotFoundException, InvalidDocumentObjectException } from './exceptions';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { next } from '@project-lakechain/sdk/decorators';

import {
  SQSEvent,
  SQSRecord,
  Context,
  SQSBatchResponse,
  S3Event,
  S3EventRecord
} from 'aws-lambda';
import {
  CloudEvent,
  EventType as DocumentEvent,
  DataEnvelope
} from '@project-lakechain/sdk/models';
import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * The async batch processor processes the received
 * events from SQS in parallel.
 */
const processor = new BatchProcessor(EventType.SQS);

/**
 * @param type the S3 event type.
 * @returns the corresponding event type in the context of
 * the cloud event specification.
 */
const getEventType = (type: string): DocumentEvent => {
  if (type.startsWith('ObjectCreated')) {
    return (DocumentEvent.DOCUMENT_CREATED);
  } else if (type.startsWith('ObjectRemoved')) {
    return (DocumentEvent.DOCUMENT_DELETED);
  } else {
    throw new Error(`Unsupported S3 event type: ${type}`);
  }
};

/**
 * When S3 emits an event, it will encode the object key
 * in the event record using quote-encoding.
 * This function restores the object key in its unencoded
 * form and returns the event record with the unquoted object key.
 * @param event the S3 event record.
 * @returns the S3 event record with the unquoted object key.
 */
const unquote = (event: S3EventRecord): S3EventRecord => {
  event.s3.object.key = decodeURIComponent(event.s3.object.key.replace(/\+/g, " "));
  return (event);
};

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * @param s3Event the S3 event record.
   * @note the `next` decorator will automatically forward the
   * returned cloud event to the next middlewares
   */
  @next()
  async s3RecordHandler(s3Event: S3EventRecord): Promise<CloudEvent> {
    const event     = unquote(s3Event);
    const eventType = getEventType(event.eventName);

    // Construct a document from the S3 object.
    const document = await getDocument(
      event.s3.bucket,
      event.s3.object,
      eventType
    );

    // Retrieve S3 Object metadata
    const metadata = await getMetadata(
      event.s3.bucket,
      event.s3.object,
      eventType
    )

    // Construct the initial event that will be consumed
    // by the next middlewares.
    return (new CloudEvent.Builder()
      .withType(eventType)
      .withData(new DataEnvelope.Builder()
        .withChainId(randomUUID())
        .withSourceDocument(document)
        .withDocument(document)
        .withMetadata(metadata)
        .build())
      .build());
  }

  /**
   * @param record an SQS record to process. This SQS record
   * contains at least an S3 event.
   * @return a promise that resolves when all the S3 events
   * contained in the SQS record have been processed.
   */
  async sqsRecordHandler(record: SQSRecord): Promise<any> {
    const event = JSON.parse(record.body) as S3Event;

    // Filter out invalid events.
    if (!Array.isArray(event.Records)) {
      return (Promise.resolve());
    }

    // For each record in the S3 event, we forward them
    // in a normalized way to the next middlewares.
    for (const record of event.Records) {
      try {
        await this.s3RecordHandler(record);
      } catch (err) {
        logger.error(err as any);
        if (err instanceof ObjectNotFoundException
          || err instanceof InvalidDocumentObjectException) {
          // If the S3 object was not found, or is not a file,
          // the event should be ignored.
          continue;
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * @param event the received SQS records, each wrapping
   * a collection of S3 events.
   * @note the input looks as follows:
   *  SQSEvent { Records: [SqsRecord<S3Event>, ...] }
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: SQSEvent, _: Context): Promise<SQSBatchResponse> {
    return (await processPartialResponse(
      event, this.sqsRecordHandler.bind(this), processor
    ));
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);

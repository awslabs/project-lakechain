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

import { SQSEvent, Context, SQSRecord } from 'aws-lambda';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { RecordMetadata } from '@pinecone-database/pinecone';
import { createClient } from './client';

import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const INCLUDE_TEXT: boolean = process.env.INCLUDE_TEXT === 'true';

/**
 * The async batch processor processes the received
 * events from SQS in parallel.
 */
const processor = new BatchProcessor(EventType.SQS);

/**
 * Lambda class definition containing the lambda handler.
 */
class Lambda implements LambdaInterface {

  /**
   * @param event the event associated with the
   * received document.
   * @returns a unique identifier for the given
   * document that is fit to identify the vectors
   * associated with the document.
   */
  private getId(event: CloudEvent) {
    const metadata = event.data().metadata();

    // If there is a chunk identifier that specifically
    // identifies a chunk associated with the given document,
    // we use that.
    if (metadata.properties?.kind === 'text'
      && metadata.properties.attrs?.chunk) {
      return (metadata.properties.attrs?.chunk.id);
    }

    return (event.data().document().id());
  }

  /**
   * @param event the event associated with the
   * received document.
   * @returns a vector embedding object associated
   * with the document.
   * @throws if the vector embedding object could not
   * be resolved.
   */
  private getEmbeddings(event: CloudEvent): Promise<number[]> {
    const metadata = event.data().metadata();

    if (metadata.properties?.kind !== 'text'
      || !metadata.properties.attrs.embeddings) {
      throw new Error('The event does not contain embeddings.');
    }

    return (metadata.properties.attrs.embeddings.vectors.resolve());
  }

  /**
   * @param event the event associated with the
   * received document.
   * @returns the metadata to associate with the
   * vectors in Pinecone.
   */
  private async getMetadata(event: CloudEvent): Promise<RecordMetadata> {
    const source   = event.data().source();
    const document = event.data().document();
    const metadata = event.data().metadata();
    const record: RecordMetadata = {};

    if (metadata.properties?.kind !== 'text') {
      throw new Error('The event is invalid.');
    }

    const attrs = metadata.properties.attrs;

    // Saving chunk information.
    if (attrs.chunk) {
      record.chunkOrder = attrs.chunk.order;
      if (attrs.chunk.startOffset) {
        record.startOffset = attrs.chunk.startOffset;
      }
      if (attrs.chunk.endOffset) {
        record.endOffset = attrs.chunk.endOffset;
      }
    }

    // If `INCLUDE_TEXT` is set to `true`, and the document
    // is a text document, we also include the original text
    // in the record.
    if (INCLUDE_TEXT && metadata.properties.kind === 'text') {
      record.text = (await document.data().asBuffer()).toString('utf-8');
    }

    // Saving the document information.
    record.sourceUrl    = source.url().toString();
    record.sourceType   = source.mimeType();
    record.documentUrl  = document.url().toString();
    record.documentType = document.mimeType();

    // Saving metadata information.
    if (metadata.title) {
      record.title = metadata.title;
    }
    if (metadata.description) {
      record.description = metadata.description;
    }
    if (metadata.image) {
      record.image = metadata.image;
    }

    return (record);
  }

  /**
   * Handles document events, retrieves their associated
   * vector embeddings and metadata, and stores them in
   * Pinecone.
   * @param record the SQS record associated with
   * the received document.
   * @returns a promise resolved when the vector embeddings
   * associated with the received document have been stored in Pinecone.
   */
  async recordHandler(record: SQSRecord): Promise<void> {
    const event    = CloudEvent.from(JSON.parse(record.body));
    const pinecone = await createClient();

    // Upsert the vector embeddings in Pinecone.
    return (pinecone.upsert([{
      id: this.getId(event),
      values: await this.getEmbeddings(event),
      metadata: await this.getMetadata(event)
    }]));
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
      event, this.recordHandler.bind(this), processor
    ));
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);

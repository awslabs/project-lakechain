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

import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { tracer, logger } from '@project-lakechain/sdk/powertools';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { ServiceIdentifier } from '../../definitions/service-identifier';

import {
  SQSEvent,
  SQSRecord,
  Context
} from 'aws-lambda';
import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const INDEX_NAME = process.env.INDEX_NAME as string;
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT as string;
const INCLUDE_DOCUMENT = process.env.INCLUDE_DOCUMENT === 'true';
const SERVICE_IDENTIFIER = process.env.SERVICE_IDENTIFIER as ServiceIdentifier;

/**
 * The OpenSearch client.
 */
const client = new Client({
  ...AwsSigv4Signer({
    region: process.env.AWS_REGION!,
    service: SERVICE_IDENTIFIER,
    getCredentials: () => {
      const credentialsProvider = defaultProvider();
      return credentialsProvider();
    }
  }),
  node: OPENSEARCH_ENDPOINT
});

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
   * @param event the event associated with the
   * received document.
   * @returns a unique identifier for the given
   * document that is fit to identify the vectors
   * associated with the document.
   */
  private getId(event: CloudEvent) {
    const metadata = event.data().metadata();
    const docId    = event.data().document().id();

    // If there is a chunk identifier that specifically
    // identifies a chunk associated with the given document,
    // we use a combination between the identifier of the
    // document and the chunk identifier.
    if (metadata.properties?.kind === 'text'
      && metadata.properties.attrs?.chunk) {
      return (`${docId}-${metadata.properties.attrs.chunk.id}`);
    }

    return (docId);
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

    if (!metadata.properties?.attrs.embeddings) {
      throw new Error('The event does not contain embeddings.');
    }
    return (metadata.properties.attrs.embeddings.vectors.resolve());
  }

  /**
   * A helper returning a representation of the document
   * to include within the index.
   * @param event the event associated with the
   * received document.
   * @returns a string or buffer representation of the
   * document.
   */
  private async getDocument(event: CloudEvent): Promise<string | Buffer> {
    const metadata = event.data().metadata();
    const buffer = await event.data()
      .document()
      .data()
      .asBuffer();

    if (metadata.properties?.kind === 'text') {
      return (buffer.toString('utf-8'));
    } else {
      return (buffer);
    }
  }

  /**
   * Inserts the given event and associated vector embeddings
   * into the OpenSearch collection index.
   * @note OpenSearch collections don't support identifiers
   * when inserting documents in the index.
   * @param event the event to process.
   * @returns a promise that resolves when the event
   * has been processed.
   */
  async processAossEvent(event: CloudEvent): Promise<any> {
    const body: Record<string, any> = {
      embeddings: await this.getEmbeddings(event),
      ...event.toJSON()
    };

    // Add an identifier to the body.
    body.documentId = this.getId(event);

    // If the document should be included, we add it to the body.
    if (INCLUDE_DOCUMENT) {
      body.text = await this.getDocument(event);
    }

    return (client.index({
      index: INDEX_NAME,
      body
    }));
  }

  /**
   * Inserts the given event and associated vector embeddings
   * into the OpenSearch collection index.
   * @param event the event to process.
   * @returns a promise that resolves when the event
   * has been processed.
   */
  async processEsEvent(event: CloudEvent): Promise<any> {
    const body: Record<string, any> = {
      embeddings: await this.getEmbeddings(event),
      ...event.toJSON()
    };

    // If the document should be included, we add it to the body.
    if (INCLUDE_DOCUMENT) {
      body.text = await this.getDocument(event);
    }

    return (client.index({
      id: this.getId(event),
      index: INDEX_NAME,
      body
    }));
  }

  /**
   * Stores the embeddings associated with the received
   * document in the OpenSearch index.
   * @param event the event to process.
   */
  async processEvent(event: CloudEvent): Promise<any> {
    if (SERVICE_IDENTIFIER === 'es') {
      return (this.processEsEvent(event));
    } else if (SERVICE_IDENTIFIER === 'aoss') {
      return (this.processAossEvent(event));
    }
  }

  /**
   * The Lambda entry point.
   * @param event the received SQS event.
   * @param _ the Lambda context.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: SQSEvent, _: Context): Promise<any> {
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

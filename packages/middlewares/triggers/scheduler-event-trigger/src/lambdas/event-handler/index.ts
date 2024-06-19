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
import { Context } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { next } from '@project-lakechain/sdk/decorators';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { getDocument } from './get-document';
import { CloudEvent, DataEnvelope, Document, EventType } from '@project-lakechain/sdk/models';

/**
 * The URIs associated with the documents to process.
 */
const DOCUMENT_URIS = JSON.parse(process.env.DOCUMENT_URIS ?? '[]');

/**
 * The URI to the placeholder document.
 */
const PLACEHOLDER = new S3DocumentDescriptor.Builder()
  .withBucket(process.env.STORAGE_BUCKET as string)
  .withKey('placeholder.json')
  .build()
  .asUri()
  .toString();

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * @param event the S3 event record.
   * @note the `next` decorator will automatically forward the
   * returned cloud event to the next middlewares
   */
  @next()
  async onDocument(document: Document): Promise<CloudEvent> {
    return (new CloudEvent.Builder()
      .withType(EventType.DOCUMENT_CREATED)
      .withData(new DataEnvelope.Builder()
        .withChainId(randomUUID())
        .withSourceDocument(document)
        .withDocument(document)
        .withMetadata({})
        .build())
      .build());
  }

  /**
   * Handles EventBridge Scheduler events and executes the logic
   * to trigger the next middlewares in the pipeline.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(_1: any, _2: Context): Promise<any> {
    let results = [];

    // If there are no given documents, it means that we're simply
    // looking to send a trigger to the next middlewares. To do so,
    // we send out a placeholder document with a specific mime-type.
    if (DOCUMENT_URIS.length === 0) {
      results = [
        await getDocument(PLACEHOLDER, 'application/json+scheduler')
      ];
    // Otherwise, we simply process the given documents to find their
    // mime-types and forward them to the next middlewares.
    } else {
      results = await Promise.all(
        DOCUMENT_URIS.map((uri: string) => {
          return (getDocument(uri));
        })
      );
    }

    // We forward each document to the next middlewares.
    for (const result of results) {
      await this.onDocument(result);
    }
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);

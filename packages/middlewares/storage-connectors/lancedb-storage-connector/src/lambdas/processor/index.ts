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

import * as lancedb from "vectordb";

import { SQSEvent, Context } from 'aws-lambda';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { makeSchema, normalizeEvent } from './schema';

/**
 * Environment variables.
 */
const LANCEDB_STORAGE = JSON.parse(process.env.LANCEDB_STORAGE as string);
const LANCEDB_TABLE_NAME = process.env.LANCEDB_TABLE_NAME as string;
const LANCEDB_VECTOR_SIZE = parseInt(process.env.LANCEDB_VECTOR_SIZE as string, 10);
const INCLUDE_TEXT: boolean = process.env.INCLUDE_TEXT === 'true';

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
   * Retrieves the table to use to store events and embeddings.
   * @returns a promise resolved with the table object.
   */
  private async getTable(): Promise<lancedb.Table> {
    const db = await lancedb.connect(LANCEDB_STORAGE.uri);
    let table: lancedb.Table;

    try {
      // Attempt to open the table.
      table = await db.openTable(LANCEDB_TABLE_NAME);
    } catch (e) {
      // If the table does not exist, we create it.
      table = await db.createTable({
        name: LANCEDB_TABLE_NAME,
        schema: makeSchema(LANCEDB_VECTOR_SIZE)
      });
    }

    return (table);
  }

  /**
   * A helper returning a textual representation of the document
   * to include within the index.
   * @param event the event associated with the
   * received document.
   * @returns a string representation of the
   * document, null if the document is not text.
   */
  private async getText(event: CloudEvent): Promise<string | null> {
    const metadata = event.data().metadata();
    const document = event.data().document();

    if (metadata.properties?.kind === 'text') {
      return ((await document.data().asBuffer()).toString('utf-8'));
    }
    return (null);
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
    const table = await this.getTable();
    const data  = [];

    // Combine all received events into a single batch.
    for (const record of event.Records) {
      const event = CloudEvent.from(JSON.parse(record.body));
      data.push({
        ...normalizeEvent(event),
        vector: await this.getEmbeddings(event),
        id: this.getId(event),
        text: INCLUDE_TEXT ? await this.getText(event) : undefined
      });
    }

    // Insert the event into the table.
    await table.add(data);
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);

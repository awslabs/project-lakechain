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
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { CloudEvent, Document } from '@project-lakechain/sdk/models';
import { next } from '@project-lakechain/sdk/decorators';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';

import {
  BASE_IMAGE_INPUTS,
  BASE_TEXT_INPUTS
} from '../../definitions/model';
import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const MODEL_ID         = process.env.MODEL_ID;
const SYSTEM_PROMPT    = JSON.parse(process.env.PROMPT as string);
const MODEL_PARAMETERS = JSON.parse(process.env.MODEL_PARAMETERS as string) as Record<string, any>;
const TARGET_BUCKET    = process.env.PROCESSED_FILES_BUCKET as string;

/**
 * The Bedrock runtime.
 */
const bedrock = tracer.captureAWSv3Client(new BedrockRuntime({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * The async batch processor processes the received
 * events from SQS in parallel.
 */
const processor = new BatchProcessor(EventType.SQS);

/**
 * Group an array of elements by a given key.
 * @param arr the array to group.
 * @param key the key to group by.
 * @returns a record mapping the given key to the
 * elements of the array.
 */
const groupBy = <T, K extends keyof any>(arr: T[], key: (i: T) => K) =>
  arr.reduce((groups, item) => {
    (groups[key(item)] ||= []).push(item);
    return groups;
  }, {} as Record<K, T[]>
);

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * Resolves the input documents to process.
   * This function supports both single and composite events.
   * @param event the received event.
   * @returns a promise to an array of CloudEvents to process.
   */
  private async resolveEvents(event: CloudEvent): Promise<CloudEvent[]> {
    const document = event.data().document();

    if (document.mimeType() === 'application/cloudevents+json') {
      const data = JSON.parse((await document
        .data()
        .asBuffer())
        .toString('utf-8')
      );
      return (data.map((event: string) => CloudEvent.from(event)));
    } else {
      return ([event]);
    }
  }

  /**
   * Computes a list of messages constructed from the input documents.
   * @param event the received event.
   * @returns an array of messages to use for generating text.
   */
  private async getMessages(event: CloudEvent) {
    const messages = [{ role: 'user', content: [] as any[] }];

    // Get the input documents.
    const events = (await this
      .resolveEvents(event))
      .filter((e: CloudEvent) => {
        const type = e.data().document().mimeType();
        return (BASE_TEXT_INPUTS.includes(type) || BASE_IMAGE_INPUTS.includes(type));
      });

    // If no documents match the supported types, throw an error.
    if (events.length === 0) {
      throw new Error('No valid input documents found.');
    }
    
    // Group documents by either `text` or `image` type.
    const group = groupBy(events, e => {
      const type = e.data().document().mimeType();
      return (BASE_TEXT_INPUTS.includes(type) ? 'text' : 'image');
    });

    // Text documents are concatenated into a single message
    // in the case where we're handling a composite event.
    if (group.text) {
      let text = '';

      if (group.text.length > 1) {
        for (const [idx, e] of group.text.entries()) {
          const document = e.data().document();
          text += `Document ${idx + 1}\n${(await document.data().asBuffer()).toString('utf-8')}\n\n`;
        }
      } else {
        const document = group.text[0].data().document();
        text = (await document.data().asBuffer()).toString('utf-8');
      }

      messages[0].content.push({ type: 'text', text });
    }

    // Image documents are added as separate messages.
    if (group.image) {
      for (const e of group.image) {
        const document = e.data().document();
        const type = document.mimeType();

        messages[0].content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: type,
            data: (await document.data().asBuffer()).toString('base64')
          }
        });
      }
    }

    return (messages);
  }

  /**
   * Constructs the body to pass to the Bedrock API.
   * @param event the cloud event associated with the
   * input document(s).
   * @returns the body to pass to the Bedrock API.
   */
  private async getBody(event: CloudEvent) {
    return ({
      anthropic_version: 'bedrock-2023-05-31',
      system: (await event.resolve(SYSTEM_PROMPT)).toString('utf-8'),
      messages: await this.getMessages(event),
      ...MODEL_PARAMETERS
    });
  }

  /**
   * Transforms the document using the given parameters.
   * @param event the CloudEvent to process.
   * @returns a promise to a buffer containing the transformed document.
   */
  private async transform(event: CloudEvent): Promise<Buffer> {
    const response = await bedrock.invokeModel({
      body: JSON.stringify(await this.getBody(event)),
      modelId: MODEL_ID,
      accept: 'application/json',
      contentType: 'application/json'
    });

    // Parse the response into a buffer.
    return (Buffer.from(
      JSON.parse(response.body.transformToString()).content[0].text
    ));
  }

  /**
   * Transforms the document using the selected Amazon Bedrock
   * model, and the given parameters.
   * @param event the CloudEvent to process.
   */
  @next()
  private async processEvent(event: CloudEvent) {
    const document = event.data().document();
    const key = `${event.data().chainId()}/${MODEL_ID}.${document.etag()}.txt`;

    // Transform the document.
    const value = await this.transform(event);

    // Write the generated text to S3.
    event.data().props.document = await Document.create({
      url: new S3DocumentDescriptor.Builder()
        .withBucket(TARGET_BUCKET)
        .withKey(key)
        .build()
        .asUri(),
      type: 'text/plain',
      data: value
    });

    return (event);
  }

  /**
   * @param record the SQS record to process that contains
   * the EventBridge event providing information about the
   * S3 event.
   */
  async recordHandler(record: SQSRecord): Promise<CloudEvent> {
    return (await this.processEvent(
      CloudEvent.from(record.body)
    ));
  }

  /**
   * The Lambda entry point.
   * @param event the received SQS event.
   * @param context the Lambda context.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handler(event: SQSEvent, _: Context) {
    return (await processPartialResponse(
      event, this.recordHandler.bind(this), processor
    ));
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);

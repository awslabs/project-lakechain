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
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const MODEL_ID          = process.env.MODEL_ID;
const SYSTEM_PROMPT     = process.env.SYSTEM_PROMPT;
const USER_PROMPT       = JSON.parse(process.env.PROMPT as string);
const ASSISTANT_PREFILL = process.env.ASSISTANT_PREFILL as string;
const MODEL_PARAMETERS  = JSON.parse(process.env.MODEL_PARAMETERS as string);
const TARGET_BUCKET     = process.env.PROCESSED_FILES_BUCKET as string;

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
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * @param event the cloud event to use to resolve the prompt.
   * @returns the prompt to use for generating text.
   */
  private async getPrompt(event: CloudEvent) {
    let text = '<s>[INST]';
    const document = event.data().document();
    const prompt = (await event.resolve(USER_PROMPT)).toString('utf-8');
    const content = (await document.data().asBuffer()).toString('utf-8');

    // Add the system prompt.
    if (SYSTEM_PROMPT) {
      text += `${SYSTEM_PROMPT} `;
    }

    // Add the user prompt and content.
    text += `${prompt}\n\n${content}[/INST] `;

    // Add the assistant prefill.
    if (ASSISTANT_PREFILL) {
      text += `${ASSISTANT_PREFILL}`;
    }

    // Add closing tag.
    text += '</s>';

    console.log(text);

    return (text);
  }

  /**
   * Transforms the document using the given parameters.
   * @param event the CloudEvent to process.
   * @returns a promise to a buffer containing the transformed document.
   */
  private async transform(event: CloudEvent): Promise<Buffer> {
    const response = await bedrock.invokeModel({
      body: JSON.stringify({
        ...MODEL_PARAMETERS,
        prompt: await this.getPrompt(event)
      }),
      modelId: MODEL_ID,
      accept: 'application/json',
      contentType: 'application/json'
    });

    // Parse the response into a buffer.
    let buffer = Buffer.from(
      JSON.parse(response.body.transformToString()).outputs[0].text.trim()
    );

    // If an assistant prefill has been passed to the model, we
    // prepend it to the generated text.
    if (ASSISTANT_PREFILL) {
      buffer = Buffer.concat([
        Buffer.from(ASSISTANT_PREFILL),
        buffer
      ]);
    }

    return (buffer);
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

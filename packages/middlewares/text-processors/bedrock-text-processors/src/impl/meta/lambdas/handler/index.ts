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
import { CloudEvent, Document } from '@project-lakechain/sdk/models';
import { next } from '@project-lakechain/sdk/decorators';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';

import {
  BedrockRuntime,
  ConverseCommand,
  ConverseCommandInput,
  Message
} from '@aws-sdk/client-bedrock-runtime';
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
   * Creates the content array to pass to the model.
   * @param events the events to create a prompt for.
   * @returns a promise to an array of messages to pass to the model.
   */
  private async getContent(event: CloudEvent) {
    const content = [{
      text: (await event.resolve(USER_PROMPT)).toString('utf-8')
    }];

    // Add the document to the prompt.
    const document = event.data().document();
    const text     = (await document.data().asBuffer()).toString('utf-8');
    content.push({
      text: `<document>\n${text}\n</document>`
    });
    
    return (content);
  }

  /**
   * Transforms the document using the given parameters.
   * @param event the CloudEvent to process.
   * @returns a promise to a buffer containing the transformed document.
   */
  private async transform(event: CloudEvent): Promise<Buffer> {
    const messages: Message[] = [{
      role: 'user',
      content: await this.getContent(event)
    }];

    // Request to the model.
    const request: ConverseCommandInput = {
      modelId: MODEL_ID,
      messages,
      inferenceConfig: MODEL_PARAMETERS
    };

    // Add the system prompt if available.
    if (SYSTEM_PROMPT) {
      request.system = [{
        text: SYSTEM_PROMPT
      }];
    }

    // Invoke the model.
    const response = await bedrock.send(new ConverseCommand(request));

    // Return the generated text.
    return (Buffer.from(
      response.output?.message?.content?.[0].text!
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

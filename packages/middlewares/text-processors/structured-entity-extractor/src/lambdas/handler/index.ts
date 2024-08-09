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

import AJV from 'ajv';

import { SQSEvent, Context, SQSRecord } from 'aws-lambda';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { CloudEvent, Document } from '@project-lakechain/sdk/models';
import { next } from '@project-lakechain/sdk/decorators';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';

import {
  InvalidSchemaException,
  InvalidResponseException
} from './exceptions';
import {
  BedrockRuntime,
  ConverseCommand,
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
const MODEL_ID         = process.env.MODEL_ID;
const TARGET_BUCKET    = process.env.PROCESSED_FILES_BUCKET as string;
const SCHEMA_REFERENCE = JSON.parse(process.env.SCHEMA as string);
const OUTPUT_TYPE      = process.env.OUTPUT_TYPE as string;
const INSTRUCTIONS     = process.env.INSTRUCTIONS as string;
const MODEL_PARAMETERS = JSON.parse(process.env.MODEL_PARAMETERS as string);

/**
 * The JSON schema validator.
 */
const ajv = new AJV();

/**
 * The name of the tool used to received extracted
 * structured data.
 */
const TOOL_NAME = 'publish_extraction_results';

/**
 * The system prompt to use when invoking a model.
 */
const SYSTEM_PROMPT = `
  You are a structured data extraction specialist.
  You are tasked with analyzing one or multiple documents, and to extract structured data from them.
`.trim();

/**
 * The user prompt to use when invoking a model.
 */
const USER_PROMPT = `
  You are given one or multiple documents below, you must extract structured data from that or those document(s),
  according to the properties given by the '${TOOL_NAME}' tool.
  If you cannot extract the value of a property, don't provide a value for that property at all.
`.trim();

/**
 * The error prompt to use when the tool fails to extract
 * structured data.
 */
const ERROR_PROMPT = `
  There have been errors in the parameters you have provided the tool.
  Please correct the errors and try again.
`.trim();

/**
 * The maximum number of retries to attempt when
 * extracting structured data.
 */
const DEFAULT_MAX_RETRIES = 5;

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
   * Creates the content array to pass to the model.
   * @param events the events to create a prompt for.
   * @returns a promise to an array of messages to pass to the model.
   */
  private async getContent(events: CloudEvent[]) {
    const content = [{
      text: USER_PROMPT
    }];

    // Add additional instructions if available.
    if (INSTRUCTIONS) {
      content.push({
        text: `Here are additional instructions you must follow when extracting structured data:
        <instructions>
          ${INSTRUCTIONS}
        </instructions>`
      });
    }

    // Add the documents to the prompt.
    for (const event of events) {
      const document = event.data().document();
      const text     = (await document.data().asBuffer()).toString('utf-8');

      content.push({
        text: `<document>\n${text}\n</document>`
      });
    }
    return (content);
  }

  /**
   * Parses the output of the data extraction tool.
   * @param result the result of the data extraction.
   * @param validateFn the validation function to use.
   * @returns the structured data extracted from the documents.
   * @throws an error if the data extraction fails.
   */
  private parseOutput(result: any, validateFn: any) {
    const output   = result.output?.message;
    const content  = output?.content;
    const response = content.find((item: any) => 'toolUse' in item);

    if (result.stopReason !== 'tool_use') {
      throw new InvalidResponseException('The data extraction tool was not invoked.');
    }
    if (!response?.toolUse) {
      throw new InvalidResponseException('The data extraction tool did not return any results.');
    }
    
    // Validate the extracted data.
    const isValid = validateFn(response.toolUse.input);
    if (!isValid) {
      throw new InvalidSchemaException(validateFn.errors, response);
    }

    return (response.toolUse.input);
  }

  /**
   * Extracts structured data from the provided documents.
   * @param events the CloudEvents to process.
   * @param maxRetries the maximum number of retries to attempt.
   * @returns a promise to an object containing the structured data
   * matching the given schema.
   * @throws an error if the data extraction fails.
   */
  private async extract(events: CloudEvent[], maxRetries = DEFAULT_MAX_RETRIES): Promise<any> {
    const messages: Message[] = [{
      role: 'user',
      content: await this.getContent(events)
    }];

    // The JSON schema to extract structured data from
    // the provided documents.
    const schema = JSON.parse(
      await events[0].resolve(SCHEMA_REFERENCE)
    );

    // The validation function to use.
    const validate = ajv.compile(schema);

    // For up to `maxRetries` attempts, we will try to extract
    // structured data from the documents.
    while (maxRetries-- > 0) {
      const result = await bedrock.send(new ConverseCommand({
        modelId: MODEL_ID,
        system: [{
          text: SYSTEM_PROMPT
        }],
        messages,
        toolConfig: {
          tools: [{
            toolSpec: {
              name: TOOL_NAME,
              description: 'A function receiving the results of the data extraction.',
              inputSchema: {
                json: schema
              }
            }
          }],
          toolChoice: {
            tool: {
              name: TOOL_NAME
            }
          }
        },
        inferenceConfig: MODEL_PARAMETERS
      }));

      // We add the assistant response to the messages.
      messages.push(result.output!.message!);

      // Parse and validate the extracted data.
      try {
        return (this.parseOutput(result, validate));
      } catch (error) {
        if (error instanceof InvalidSchemaException) {
          // The extracted data are invalid, we want to prompt the model
          // with the errors to correct the generated data.
          messages.push({
            role: 'user',
            content: [{
              toolResult: {
                toolUseId: error.getResponse().toolUse.toolUseId,
                content: [{
                  text: `${ERROR_PROMPT}\n${JSON.stringify(error.getErrors())}`
                }],
                status: 'error'
              }
            }]
          });
        }
      }
    }

    throw new Error('Failed to extract structured data.');
  }

  /**
   * Transforms the document using the selected Amazon Bedrock
   * model, and the given parameters.
   * @param event the CloudEvent to process.
   */
  @next()
  private async processEvent(event: CloudEvent): Promise<CloudEvent> {
    const document = event.data().document();
    const events   = await this.resolveEvents(event);
    const key      = `${event.data().chainId()}/${MODEL_ID}.${document.etag()}.json`;

    if (events.length === 0) {
      throw new Error('No valid input documents found.');
    }

    // Extract data from the provided documents.
    const value = await this.extract(events);

    if (OUTPUT_TYPE === 'json') {
      // Write the structured data to S3.
      event.data().props.document = await Document.create({
        url: new S3DocumentDescriptor.Builder()
          .withBucket(TARGET_BUCKET)
          .withKey(key)
          .build()
          .asUri(),
        type: 'application/json',
        data: Buffer.from(JSON.stringify(value))
      });
    } else {
      // Add the structured data to the metadata.
      event.data().metadata().custom ??= {};
      event.data().metadata().custom!.structured = value;
    }

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

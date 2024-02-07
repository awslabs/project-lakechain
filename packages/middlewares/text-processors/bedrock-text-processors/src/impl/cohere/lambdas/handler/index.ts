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
import { CloudEvent } from '@project-lakechain/sdk/models';
import { next } from '@project-lakechain/sdk/decorators';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { CohereTextModel } from '../../definitions/model';

import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const TEXT_MODEL = JSON.parse(process.env.TEXT_MODEL as string) as CohereTextModel;
const DOCUMENT = JSON.parse(process.env.DOCUMENT as string);
const PROMPT = JSON.parse(process.env.PROMPT as string);
const MODEL_PARAMETERS = JSON.parse(process.env.MODEL_PARAMETERS as string) as Record<string, any>;
const PROCESSED_FILES_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;

/**
 * The Bedrock runtime.
 */
const bedrock = tracer.captureAWSv3Client(new BedrockRuntime({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * The S3 client.
 */
const s3 = tracer.captureAWSv3Client(new S3Client({
  region: process.env.AWS_REGION,
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
   * @param event the cloud event to use to resolve
   * the prompt.
   * @returns the prompt to use for generating text.
   */
  private async getPrompt(event: CloudEvent) {
    return (`${await event.resolve(DOCUMENT)}\n\n${await event.resolve(PROMPT)}`);
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
      modelId: TEXT_MODEL.name,
      accept: 'application/json',
      contentType: 'application/json'
    });

    // Parse the response into a buffer.
    return (Buffer.from(
      JSON.parse(response.body.transformToString()).generations[0].text
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
    const key = `${event.data().chainId()}/cohere.${document.etag()}.txt`;

    // Transform the document.
    const value = await this.transform(event);

    // Write the generated text to S3.
    const res = await s3.send(new PutObjectCommand({
      Bucket: PROCESSED_FILES_BUCKET,
      Key: key,
      Body: value,
      ContentType: 'text/plain'
    }));

    // Update the event.
    document.props.url = new S3DocumentDescriptor.Builder()
      .withBucket(PROCESSED_FILES_BUCKET)
      .withKey(key)
      .build()
      .asUri();
    document.props.type = 'text/plain';
    document.props.size = value.byteLength;
    document.props.etag = res.ETag?.replace(/"/g, '');

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

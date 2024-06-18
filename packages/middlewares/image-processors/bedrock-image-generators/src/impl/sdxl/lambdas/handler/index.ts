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
import { next } from '@project-lakechain/sdk/decorators';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';

import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const IMAGE_MODEL = process.env.IMAGE_MODEL as string;
const PROMPT = JSON.parse(process.env.PROMPT as string);
const NEGATIVE_PROMPTS = JSON.parse(process.env.NEGATIVE_PROMPTS as string);
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
   * Generates an array of prompt attributes (both positive and negative)
   * to be used for generating images.
   * @param event the CloudEvent to process.
   * @returns a promise that resolves to the list of prompt
   * to use for generating images.
   */
  async getPrompts(event: CloudEvent): Promise<object[]> {
    const negativePrompts = [];

    for (const negativePrompt of NEGATIVE_PROMPTS) {
      negativePrompts.push({
        text: (await event.resolve(negativePrompt)).toString(),
        weight: -1.0
      });
    }
    
    return ([{
      text: (await event.resolve(PROMPT)).toString(),
      weight: 1.0
    }, ...negativePrompts]);
  }

  /**
   * @param event the CloudEvent to process.
   * @returns a promise that resolves to the init image
   * to use for generating images in base 64, or `undefined` if
   * no init image is specified.
   */
  async getInitImage(event: CloudEvent): Promise<string | undefined> {
    if (!MODEL_PARAMETERS.init_image) {
      return (Promise.resolve(undefined));
    }
    return ((await event.resolve(MODEL_PARAMETERS.init_image)).toString('base64'));
  }

  /**
   * @param event the CloudEvent to process.
   * @returns a promise that resolves to the mask image
   * to use for inpainting generation in base 64, or `undefined` if
   * no mask image is specified.
   */
  async getMaskImage(event: CloudEvent): Promise<string | undefined> {
    if (!MODEL_PARAMETERS.mask_image) {
      return (Promise.resolve(undefined));
    }
    return ((await event.resolve(MODEL_PARAMETERS.mask_image)).toString('base64'));
  }

  /**
   * Generates an image using a Bedrock model and
   * the given parameters.
   * @param event the CloudEvent to process.
   */
  @next()
  private async processEvent(event: CloudEvent) {
    const document = event.data().document();
    const key = `${event.data().chainId()}/sdxl.${document.etag()}.png`;

    // Generate the image.
    const response = await bedrock.invokeModel({
      body: JSON.stringify({
        ...MODEL_PARAMETERS,
        text_prompts: await this.getPrompts(event),
        init_image: await this.getInitImage(event),
        mask_image: await this.getMaskImage(event)
      }),
      modelId: IMAGE_MODEL,
      accept: 'application/json',
      contentType: 'application/json'
    });

    // Parse the response as a JSON object.
    const value = JSON.parse(response.body.transformToString());

    // Store the resulting image as a buffer.
    const newImage = Buffer.from(value.artifacts[0].base64, 'base64');

    // Write the new image to S3.
    const res = await s3.send(new PutObjectCommand({
      Bucket: PROCESSED_FILES_BUCKET,
      Key: key,
      Body: newImage,
      ContentType: 'image/png'
    }));

    // Update the event.
    document.props.url = new S3DocumentDescriptor.Builder()
      .withBucket(PROCESSED_FILES_BUCKET)
      .withKey(key)
      .build()
      .asUri();
    document.props.type = 'image/png';
    document.props.size = newImage.byteLength;
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
   * @param _ the Lambda context.
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

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
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { textToImage } from './generation/text-to-image';
import { imageInpainting } from './generation/image-inpainting';
import { imageOutpainting } from './generation/image-outpainting';
import { imageVariation } from './generation/image-variation';

import {
  TextToImageProps,
  ImageInpaintingProps,
  ImageOutpaintingProps,
  ImageVariationProps
} from '../../definitions/tasks';
import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * The type of task properties.
 */
type TaskProps = TextToImageProps
  | ImageInpaintingProps
  | ImageOutpaintingProps
  | ImageVariationProps;

/**
 * Environment variables.
 */
const TASK: TaskProps = JSON.parse(process.env.TASK as string);
const PROCESSED_FILES_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;

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
   * Uploads the given image to the middleware internal storage,
   * and forwards the new document to the next middlewares.
   * @param idx the index of the image.
   * @param image a buffer of image to upload.
   * @param event the CloudEvent to process.
   * @returns a promise resolving to the updated CloudEvent.
   */
  @next()
  private async onImage(idx: number, image: Buffer, event: CloudEvent) {
    const newEvent = event.clone();
    const document = newEvent.data().document();
    const key = `${newEvent.data().chainId()}/amazon-titan.${document.etag()}-${idx}.png`;

    // Upload the image to S3.
    const res = await s3.send(new PutObjectCommand({
      Bucket: PROCESSED_FILES_BUCKET,
      Key: key,
      Body: image,
      ContentType: 'image/png',
      ContentLength: image.byteLength
    }));

    // Update the event.
    document.props.url = new S3DocumentDescriptor.Builder()
      .withBucket(PROCESSED_FILES_BUCKET)
      .withKey(key)
      .build()
      .asUri();
    document.props.type = 'image/png';
    document.props.size = image.byteLength;
    document.props.etag = res.ETag?.replace(/"/g, '');

    return (newEvent);
  }

  /**
   * Generates an image using a Bedrock model and
   * the given parameters.
   * @param event the CloudEvent to process.
   */
  private async processEvent(event: CloudEvent) {
    let images: Buffer[] = [];

    if (TASK.taskType === 'TEXT_IMAGE') {
      images = await textToImage(event, TASK);
    } else if (TASK.taskType === 'INPAINTING') {
      images = await imageInpainting(event, TASK);
    } else if (TASK.taskType === 'OUTPAINTING') {
      images = await imageOutpainting(event, TASK);
    } else if (TASK.taskType === 'IMAGE_VARIATION') {
      images = await imageVariation(event, TASK);
    } else {
      throw new Error(`Unsupported task type`);
    }

    // Upload the images and forward them to the next middlewares.
    for (const [idx, image] of images.entries()) {
      await this.onImage(idx, image, event);
    }
  }

  /**
   * @param record the SQS record to process that contains
   * the EventBridge event providing information about the
   * S3 event.
   */
  async recordHandler(record: SQSRecord): Promise<any> {
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

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

import sharp from 'sharp';

import { SQSEvent, SQSRecord, Context, SQSBatchResponse } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { next } from '@project-lakechain/sdk/decorators';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getOpts } from './ops';
import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * The S3 client.
 */
const s3 = tracer.captureAWSv3Client(new S3Client({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * Environment variables.
 */
const PROCESSED_FILES_BUCKET = process.env.PROCESSED_FILES_BUCKET;

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
   * @param event the event to process.
   * @note the next decorator will automatically forward the
   * returned cloud event to the next middlewares
   */
  @next()
  async processEvent(event: CloudEvent): Promise<CloudEvent> {
    const document = event.data().document();

    // De-serialize the Sharp operations to apply.
    const ops = await getOpts(event);

    // Create a sharp pipeline using the image buffer.
    let pipeline = sharp(await document.data().asBuffer()) as any;

    // The output type and extension are set to the type
    // and extension of the input document.
    let outputType = document.mimeType();
    let outputExt  = document.filename().extension();

    // We apply the operations to the pipeline.
    for (const op of ops) {
      pipeline = pipeline[op.method](...op.args);
      // If the operation transforms the output type of the image, we
      // capture the new output type and extension.
      if (op.outputType) {
        outputType = op.outputType.mimeType;
        outputExt = op.outputType.extension;
      }
    }

    // The output buffer containing the processed image.
    const buffer = await pipeline.toBuffer();

    // We upload the processed document to the processed
    // documents bucket.
    const key = `${event.data().chainId()}/${document.filename().name()}.${outputExt}`;
    const res = await s3.send(new PutObjectCommand({
      Bucket: PROCESSED_FILES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: outputType
    }));

    // We update the document metadata with the new
    // document URL.
    document.props.url = new URL(`s3://${PROCESSED_FILES_BUCKET}/${key}`);
    document.props.type = outputType;
    document.props.size = buffer.byteLength;
    document.props.etag = res.ETag?.replace(/"/g, '');

    return (event);
  }

  /**
   * The Lambda entry point.
   * @param event the received SQS event.
   * @param _ the Lambda context.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: SQSEvent, _: Context): Promise<SQSBatchResponse> {
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

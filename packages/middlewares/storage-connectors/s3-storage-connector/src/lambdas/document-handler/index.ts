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

import path from 'path';

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { S3DocumentDescriptor, S3StreamCopier } from '@project-lakechain/sdk/helpers';

import {
  S3Client,
  PutObjectCommand,
  StorageClass
} from '@aws-sdk/client-s3';
import {
  SQSEvent,
  SQSRecord,
  Context,
  SQSBatchResponse
} from 'aws-lambda';
import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const TARGET_BUCKET = process.env.TARGET_BUCKET as string;
const COPY_DOCUMENTS = process.env.COPY_DOCUMENTS === 'true';
const STORAGE_CLASS = process.env.STORAGE_CLASS as StorageClass;

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
   * @param event the event to process.
   */
  async processEvent(event: CloudEvent): Promise<any> {
    const data = event.data();
    const document = data.document();
    const outputPrefix = `output/${data.chainId()}`;

    // If `COPY_DOCUMENTS` is set to `true`, we copy the
    // the current document to the target bucket.
    if (COPY_DOCUMENTS) {
      const copier = new S3StreamCopier.Builder()
        .withSource(document)
        .withDestination(new S3DocumentDescriptor.Builder()
          .withBucket(TARGET_BUCKET)
          .withKey(path.join(outputPrefix, document.filename().basename()))
          .build()
        )
        .withOptions({
          ContentType: document.mimeType(),
          StorageClass: STORAGE_CLASS
        })
        .build();
      await copier.copy();
    }

    // We also copy the document metadata to the target bucket.
    await s3.send(new PutObjectCommand({
      Bucket: TARGET_BUCKET,
      Key: path.join(outputPrefix, `${document.filename().basename()}.metadata.json`),
      Body: JSON.stringify(event),
      ContentType: 'application/json',
      StorageClass: STORAGE_CLASS
    }));

    return (logger.info(event as any));
  }

  /**
   * The Lambda entry point.
   * @param event the received SQS event.
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

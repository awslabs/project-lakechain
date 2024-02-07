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

import jmespath from 'jmespath';

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { next } from '@project-lakechain/sdk/decorators';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
const EXPRESSION    = process.env.EXPRESSION as string;
const TARGET_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;

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
   * @param obj a javascript object.
   * @returns the type of the object.
   */
  private getType(obj: any): string {
    if (typeof obj === 'object') {
      return ('application/json');
    }
    return ('text/plain');
  }

  /**
   * @param event the event to process.
   * @note the next decorator will automatically forward the
   * returned cloud event to the next middlewares
   */
  @next()
  async processEvent(event: CloudEvent): Promise<CloudEvent> {
    const document  = event.data().document();
    const chainId   = event.data().chainId();
    const outputKey = `${chainId}/${document.etag()}`;

    // We load the JSON document in memory.
    const json = JSON.parse((await document.data().asBuffer()).toString('utf-8'));

    // We apply the JMESPath expression to the JSON document.
    const result = jmespath.search(json, EXPRESSION);

    // Determine the type and body of the result.
    const type = this.getType(result);
    const value = type === 'application/json' ? JSON.stringify(result) : result;

    // Update the result as a new document.
    const res = await s3.send(new PutObjectCommand({
      Bucket: TARGET_BUCKET,
      Key: outputKey,
      Body: value,
      ContentType: type
    }));

    // Update the event.
    document.props.url = new S3DocumentDescriptor.Builder()
      .withBucket(TARGET_BUCKET)
      .withKey(outputKey)
      .build()
      .asUri();
    document.props.type = type;
    document.props.size = value.length;
    document.props.etag = res.ETag?.replace(/"/g, '');

    return (event);
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
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
import merge from 'lodash/merge';

import { Context, S3Event, S3EventRecord } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { nextAsync } from '@project-lakechain/sdk/decorators';
import { TranslationDetails } from '../definitions/translation-details.js';

import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';

/**
 * The DynamoDB client.
 */
const dynamodb = tracer.captureAWSv3Client(new DynamoDBClient({
  region: process.env.AWS_REGION,
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
 * When S3 emits an event, it will encode the object key
 * in the event record using quote-encoding.
 * This function restores the object key in its unencoded
 * form and returns the event record with the unquoted object key.
 * @param event the S3 event record.
 * @returns the S3 event record with the unquoted object key.
 */
const unquote = (key: string): string => {
  return (decodeURIComponent(key.replace(/\+/g, " ")));
};

/**
 * @param bucket the bucket name to encode.
 * @param key the key name to encode.
 * @returns the URI for the specified bucket and key.
 */
const toUri = (bucket: string, key: string): URL => {
  return (new S3DocumentDescriptor({ bucket, key }).asUri());
};

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * @param jobName the Amazon Translate job name
   * associated with the cloud event to retrieve.
   * @returns the cloud event associated with the given
   * Amazon Translate job identifier.
   */
  private async getJobEvent(jobName: string): Promise<CloudEvent> {
    const { Item } = await dynamodb.send(new GetItemCommand({
      TableName: process.env.MAPPING_TABLE,
      Key: {
        TranslationJobId: { S: jobName }
      }
    }));
    return (CloudEvent.from(JSON.parse(Item?.event.S as string)));
  }

  /**
   * This method takes a `TranslationDetails` object and returns
   * an array of cloud events associated with the translated documents.
   * @param metadata the metadata file issued by Amazon Translate.
   * @note we are expecting in the metadata file a `outputDataPrefix`
   * property containing the prefix of the produced documents that looks as follows:
   * s3://${bucket}/outputs/${jobName}/${accountId}-TranslateText-${jobId}
   */
  async toEvents(metadata: TranslationDetails) {
    const outputPrefix = new URL(metadata.outputDataPrefix);
    const paths = outputPrefix.pathname.split('/').slice(1);
    const event = await this.getJobEvent(paths[1]);
    const events = [];

    for (const detail of metadata.details) {
      const clone    = event.clone();
      const document = clone.data().document();
      const key      = path.join(...paths, detail.targetFile);

      // Get information about the translated document.
      const data = await s3.send(new HeadObjectCommand({
        Bucket: outputPrefix.hostname,
        Key: key
      }));

      // Update the document.
      document.props.url = toUri(outputPrefix.hostname, key);
      document.props.etag = data.ETag?.replace(/"/g, '');
      document.props.size = data.ContentLength;

      // Update the metadata.
      merge(clone.data().props.metadata, {
        language: metadata.targetLanguageCode,
        properties: {
          kind: 'text',
          attrs: {}
        }
      });

      events.push(clone);
    }

    return (events);
  }

  /**
   * This method attempts to parse the translation metadata file
   * created by Amazon Translate containing the files produced
   * by the translation job.
   * @param record the S3 event record to process containing
   * information about the produced metadata file by Amazon Translate.
   * @returns a promise to the S3 event record.
   */
  async onS3Event(record: S3EventRecord): Promise<S3EventRecord> {
    const key = unquote(record.s3.object.key);

    // Amazon Translate creates a job description which is initially empty.
    // We ignore any empty file.
    if (record.s3.object.size === 0) {
      return (record);
    }

    try {
      // Load the metadata file in memory.
      const data = await (await s3.send(new GetObjectCommand({
        Bucket: record.s3.bucket.name,
        Key: key
      }))).Body?.transformToString();

      // Try to parse the metadata.
      const metadata: TranslationDetails = JSON.parse(data as string);

      // Resolve the cloud event associated with each translated document.
      const events = await this.toEvents(metadata);

      // Forward the new documents to the next middlewares.
      for (const event of events) {
        await nextAsync(event);
      }
    } catch (err) {
      logger.error(err as any);
    }

    return (record);
  }

  /**
   * The Lambda entry point.
   * @param event the received S3 event.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handler(event: S3Event, _: Context): Promise<any> {
    return (Promise.all(
      event.Records.map((record) => this.onS3Event(record))
    ));
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);

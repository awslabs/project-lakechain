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

import { Context, S3Event, S3EventRecord } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { next } from '@project-lakechain/sdk/decorators';

/**
 * The DynamoDB client.
 */
const dynamodb = tracer.captureAWSv3Client(new DynamoDBClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * A mapping between file extensions produced by Amazon Transcribe
 * and their corresponding MIME types.
 */
const types: { [key: string]: string } = {
  '.vtt': 'text/vtt',
  '.srt': 'application/x-subrip',
  '.json': 'application/json+amazon-transcribe'
};

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
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * @param jobId the Amazon Transcribe job identifier
   * associated with the cloud event to retrieve.
   * @returns the cloud event associated with the given
   * Amazon Transcribe job identifier.
   */
  private async getJobEvent(jobId: string): Promise<CloudEvent> {
    const { Item } = await dynamodb.send(new GetItemCommand({
      TableName: process.env.MAPPING_TABLE,
      Key: {
        TranscriptionJobId: { S: jobId }
      }
    }));
    return (CloudEvent.from(JSON.parse(Item?.event.S as string)));
  }

  /**
   * Handles the transcription result produced by Amazon Transcribe
   * and forwards the produced document(s) to the next middlewares.
   * @param record the S3 event record to process containing
   * information about the produced transcription by Amazon Transcribe.
   * @returns the cloud event associated with the transcription file.
   */
  @next()
  async recordHandler(record: S3EventRecord): Promise<CloudEvent> {
    try {
      const key      = unquote(record.s3.object.key);
      const parsed   = path.parse(key);
      const ext      = parsed.ext;
      const event    = await this.getJobEvent(parsed.name);
      const document = event.data().document();

      // Create a URL pointing to the produced document.
      const url = new S3DocumentDescriptor({
        bucket: record.s3.bucket.name,
        key
      }).asUri();

      // Update the document.
      document.props.url = url;
      document.props.etag = record.s3.object.eTag.replace(/"/g, '');
      document.props.size = record.s3.object.size;
      document.props.type = types[ext];

      return (event);
    } catch (err) {
      logger.error(err as any);
      throw err;
    }
  }

  /**
   * The Lambda entry point.
   * @param event the received S3 event.
   * @param _ the Lambda context.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handler(event: S3Event, _: Context): Promise<any> {
    return (Promise.all(
      event.Records.map((record) => this.recordHandler(record))
    ));
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);

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

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { Context, SNSEvent } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { next } from '@project-lakechain/sdk/decorators';

import {
  S3Client,
  HeadObjectCommand,
  HeadObjectCommandOutput
} from '@aws-sdk/client-s3';

/**
 * The S3 client.
 */
const s3 = tracer.captureAWSv3Client(new S3Client({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * The DynamoDB client.
 */
const dynamodb = tracer.captureAWSv3Client(new DynamoDBClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * @param taskId the Amazon Polly task identifier
   * associated with the cloud event to retrieve.
   * @returns the cloud event associated with the given
   * Amazon Polly task identifier.
   */
  private async getJobEvent(taskId: string): Promise<CloudEvent> {
    const { Item } = await dynamodb.send(new GetItemCommand({
      TableName: process.env.MAPPING_TABLE,
      Key: {
        SynthesisTaskId: { S: taskId }
      }
    }));
    return (CloudEvent.from(JSON.parse(Item?.event.S as string)));
  }

  /**
   * Retrieves object metadata from S3.
   * @param bucket the bucket name.
   * @param key the object key.
   * @returns the object metadata.
   */
  private async getObject(bucket: string, key: string): Promise<HeadObjectCommandOutput> {
    const res = await s3.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key
    }));
    return (res);
  }

  /**
   * Handles the synthesis result produced by Amazon Polly
   * and forwards the produced document(s) to the next middlewares.
   * @param event the SNS event record to process containing
   * information about the produced synthesis by Amazon Polly.
   * @returns the cloud event associated with the synthesized file.
   */
  @next()
  async processEvent(event: any): Promise<CloudEvent> {
    const uri        = S3DocumentDescriptor.fromUri(event.outputUri);
    const cloudEvent = await this.getJobEvent(event.taskId);
    const object     = await this.getObject(uri.bucket(), uri.key());
    const document   = cloudEvent.data().document();

    // Update the document.
    document.props.url  = event.outputUri;
    document.props.etag = object.ETag?.replace(/"/g, '');
    document.props.size = object.ContentLength;
    document.props.type = object.ContentType!;

    return (cloudEvent);
  }

  /**
   * The Lambda entry point.
   * @param event the received SQS event.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: SNSEvent, _: Context): Promise<any> {
    for (const record of event.Records) {
      try {
        await this.processEvent(JSON.parse(record.Sns.Message));
      } catch (err) {
        logger.error(err as any);
        throw err;
      }
    }
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);

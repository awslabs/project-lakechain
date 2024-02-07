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

import merge from 'lodash/merge';

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { next } from '@project-lakechain/sdk/decorators';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { S3Stream } from '@project-lakechain/sdk/helpers';
import { S3Client, PutObjectCommand, CompleteMultipartUploadCommandOutput } from '@aws-sdk/client-s3';
import { convert } from './convert';
import { getMetadata } from './metadata';

import {
  MailParser,
  Headers,
  MessageText,
  AttachmentStream
} from 'mailparser';
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
const TARGET_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;
const OUTPUT_FORMAT = process.env.OUTPUT_FORMAT as string;
const INCLUDE_ATTACHMENTS = process.env.INCLUDE_ATTACHMENTS === 'true';
const INCLUDE_IMAGE_LINKS = process.env.INCLUDE_IMAGE_LINKS === 'true';

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
 * The S3 stream helper.
 */
const stream = new S3Stream();

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * A method called back to handle attachments parsed
   * within an email document.
   * @param e the original cloud event associated with
   * the email document.
   * @param attachment the attachment stream to process.
   * @returns a new cloud event with the updated document
   * properties.
   */
  @next()
  private async onAttachment(
    e: CloudEvent,
    attachment: AttachmentStream
  ): Promise<CloudEvent> {
    const event     = e.clone();
    const chainId   = event.data().chainId();
    const document  = event.data().document();
    const outputKey = `${chainId}/attachments/${attachment.filename}`;

    const { writeStream, promise } = stream.createS3WriteStream({
      bucket: TARGET_BUCKET,
      key: outputKey,
      contentType: attachment.contentType
    });

    // Pipe the attachment to the write stream.
    attachment.content.pipe(writeStream);

    // Wait for the upload to finish.
    return (promise.then((res: CompleteMultipartUploadCommandOutput) => {
      document.props.url = new S3DocumentDescriptor.Builder()
        .withBucket(TARGET_BUCKET)
        .withKey(outputKey)
        .build()
        .asUri();
      document.props.type = attachment.contentType;
      document.props.size = attachment.size;
      document.props.etag = res.ETag?.replace(/"/g, '');

      return (event);
    }));
  }

  /**
   * A method called back to handle the text parsed
   * within an email document.
   * @param e the original cloud event associated with
   * the email document.
   * @param text the text to process.
   * @param headers the headers of the email document.
   * @returns a new cloud event with the updated document
   * properties.
   */
  @next()
  private async onText(
    e: CloudEvent,
    text: MessageText,
    headers: Headers
  ): Promise<CloudEvent> {
    const event     = e.clone();
    const chainId   = event.data().chainId();
    const document  = event.data().document();
    const outputKey = `${chainId}/${document.etag()}`;

    // Convert the text to the desired output format.
    const { mimeType, data } = convert(text, headers, OUTPUT_FORMAT);

    // Update the result as a new document.
    const res = await s3.send(new PutObjectCommand({
      Bucket: TARGET_BUCKET,
      Key: outputKey,
      Body: data,
      ContentType: mimeType
    }));

    // Update the event.
    document.props.url = new S3DocumentDescriptor.Builder()
      .withBucket(TARGET_BUCKET)
      .withKey(outputKey)
      .build()
      .asUri();
    document.props.type = mimeType;
    document.props.size = data.length;
    document.props.etag = res.ETag?.replace(/"/g, '');

    // Enrich the metadata of the document.
    merge(event.data().props.metadata, getMetadata(headers));

    return (event);
  }

  /**
   * A function creating a closure capturing the
   * email document parsing results.
   * @param e the cloud event associated with the
   * email document.
   * @returns a closure exposing the event handlers
   * to process the email document.
   */
  private createCallbacks(event: CloudEvent, parser: MailParser) {
    let headers: Headers;

    return ({
      onData: (data: AttachmentStream | MessageText) => {
        if (data.type === 'attachment') {
          if (!INCLUDE_ATTACHMENTS) {
            data.release();
          } else {
            this.onAttachment(event, data).then(() => data.release());
          }
        } else {
          parser.pause();
          this.onText(event, data, headers).then(() => parser.resume());
        }
      },
      onHeaders: (h: Headers) => headers = h
    });
  }

  /**
   * Parses the input email document, and processes its
   * content, attachments and headers as a stream.
   * @param event the event to process.
   * @note the next decorator will automatically forward the
   * returned cloud event to the next middlewares
   */
  async processEvent(event: CloudEvent): Promise<any> {
    const document = event.data().document();
    const parser   = new MailParser({
      skipImageLinks: !INCLUDE_IMAGE_LINKS
    });

    // We create a readable stream from the document.
    const readable = await document.data().asReadStream();

    // Create a closure capturing the parsing results.
    const callback = this.createCallbacks(event, parser);

    // Setup event handlers.
    parser.on('headers', callback.onHeaders);
    parser.on('data', callback.onData);

    return (new Promise((resolve, reject) => {
      readable
        .pipe(parser)
        .on('error', reject)
        .on('end', resolve);
    }));
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

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
import stream from 'stream';
import util from 'util';
import streamz from 'streamz';
import mimeTypes from './mime-types.json';

import { Parse, Entry } from 'unzipper';
import { S3Stream, S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { SQSEvent, Context, SQSRecord, SQSBatchResponse } from 'aws-lambda';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { CloudEvent, Document } from '@project-lakechain/sdk/models';
import { next } from '@project-lakechain/sdk/decorators';
import { CompleteMultipartUploadCommandOutput } from '@aws-sdk/client-s3';

import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

/**
 * Environment variables.
 */
const PROCESSED_FILES_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;

/**
 * The async batch processor processes the received
 * events from SQS in parallel.
 */
const processor = new BatchProcessor(EventType.SQS);

/**
 * The S3 stream helper.
 */
const s3Stream = new S3Stream();

/**
 * Compute the file type given a file name.
 * @param file the file name.
 * @return the file type.
 */
export const mimeTypeFromExtension = (file: string): string => {
  const types = mimeTypes as { [key: string]: string };
  const extension = file.split('.').pop();
  return (types[`.${extension}`] ?? 'application/octet-stream');
};

class Lambda implements LambdaInterface {

  /**
   * Called back when a file has been uploaded and will
   * be sent to the next middlewares using the `next`
   * decorator.
   * @param uploadResult the upload result.
   * @param mimeType the mime type of the file.
   * @param size the size of the file.
   * @param event the CloudEvent to process.
   */
  @next()
  private onDocumentCreated(
    uploadResult: any,
    mimeType: string,
    size: number,
    event: CloudEvent
  ): Promise<CloudEvent> {
    const result = uploadResult as CompleteMultipartUploadCommandOutput;
    const cloudEvent = event.clone();

    // Update the current document information with
    // the extracted file.
    cloudEvent.data().props.document = new Document.Builder()
      .withUrl(new S3DocumentDescriptor({
          bucket: result.Bucket!,
          key: result.Key!
        }).asUri()
      )
      .withEtag(result.ETag!.replace(/"/g, ''))
      .withSize(size)
      .withType(mimeType)
      .build();

    return (Promise.resolve(cloudEvent));
  }

  /**
   * Handles each entry in the zip archive and pipes
   * the entry into the S3 destination stream.
   * @param event the CloudEvent to process.
   * @param destinationBucket the bucket where to pipe the entry.
   */
  private pipeToS3(event: CloudEvent, destinationBucket: string) {
    const document = event.data().document();
    const prefix = `${event.data().chainId()}/${document.etag()}`;

    return async (entry: Entry) => {
      if (entry.type !== 'Directory') {
        // Compute the mime type of the file.
        const mimeType = mimeTypeFromExtension(entry.path);
        // Create a write stream to the destination bucket.
        const { writeStream, promise } = s3Stream.createS3WriteStream({
          bucket: destinationBucket,
          key: path.join(prefix, entry.path),
          contentType: mimeType
        });
        // Start uploading the file.
        entry.pipe(writeStream);
        // Wait for the upload to complete and send the
        // extracted document to the next middlewares.
        await promise.then((res) => {
          // @ts-expect-error
          return (this.onDocumentCreated(res, mimeType, entry.vars.uncompressedSize, event));
        });
      } else {
        entry.autodrain();
      }
    };
  }

  /**
   * Processes the given event and unzips the object
   * associated with the event into the bucket
   * passed as `destBucket`.
   * The entire operation happens in streaming to avoid loading
   * the entirety of the zip file in memory.
   * @param event the CloudEvent to process.
   * @param destBucket the destination bucket where
   * to unzip the resulting files.
   * @returns a promise which resolves when the
   * unzip process is complete.
   */
  private async unzip(event: CloudEvent, destBucket: string) {
    const pipeline = util.promisify(stream.pipeline);
    const document = event.data().document();

    // Create a read stream to the zip archive.
    const readStream = await document.data().asReadStream();

    // Unzip the archive in streaming.
    return (pipeline(
      readStream,
      Parse(),
      streamz(this.pipeToS3(event, destBucket))
    ));
  }

  /**
   * Inflates the document associated with the record
   * in the target S3 bucket.
   * @param record the SQS record associated with
   * the document to inflate.
   */
  recordHandler(record: SQSRecord): Promise<any> {
    return (this.unzip(
      CloudEvent.from(JSON.parse(record.body)),
      PROCESSED_FILES_BUCKET
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
  async handler(event: SQSEvent, _: Context): Promise<SQSBatchResponse> {
    return (await processPartialResponse(
      event, this.recordHandler.bind(this), processor
    ));
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);
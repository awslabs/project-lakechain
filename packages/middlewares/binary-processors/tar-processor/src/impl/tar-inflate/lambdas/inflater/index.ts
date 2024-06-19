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
import events from 'events';
import tar from 'tar-stream';
import gunzip from 'gunzip-maybe';
import mimeTypes from './mime-types.json';

import { S3Stream, S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { SQSEvent, Context, SQSRecord } from 'aws-lambda';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
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
 * The S3 stream helper.
 */
const s3Stream = new S3Stream();

/**
 * The async batch processor processes the received
 * events from the DynamoDB stream in parallel.
 */
const processor = new BatchProcessor(EventType.DynamoDBStreams);

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
   * Called back when a document is created and will
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
    const descriptor = new S3DocumentDescriptor({
      bucket: result.Bucket!,
      key: result.Key!
    });

    // Update the current document information with
    // the extracted file.
    cloudEvent.data().props.document = new Document.Builder()
      .withUrl(descriptor.asUri())
      .withEtag(result.ETag!.replace(/"/g, ''))
      .withSize(size)
      .withType(mimeType)
      .build();

    return (Promise.resolve(cloudEvent));
  }

  /**
   * Handles each entry in the archive and pipes
   * the entry into the S3 destination stream.
   * @param event the CloudEvent to process.
   * @param destinationBucket the bucket where to pipe the entry.
   */
  private createEntryListener(event: CloudEvent, destinationBucket: string) {
    const emitter  = new events.EventEmitter();
    const document = event.data().document();
    const prefix   = `${event.data().chainId()}/${document.etag()}`;

    return {
      handler: (header: tar.Headers, stream: any, next: tar.Callback) => {
        // We signal the end of the entry read to the tar stream.
        stream.on('end', next);

        if (header.type === 'file') {
          const mimeType = mimeTypeFromExtension(header.name);
          // Create a write stream to the destination bucket.
          const { writeStream, promise } = s3Stream.createS3WriteStream({
            bucket: destinationBucket,
            key: path.join(prefix, header.name),
            contentType: mimeType
          });
          // Write the unzipped file to the destination bucket.
          stream.pipe(writeStream);
          // Listens for file write completion events and notify the
          // next middlewares.
          emitter.emit('write-promise', promise.then((res) => {
            return (this.onDocumentCreated(res, mimeType, header.size!, event));
          }));
        } else {
          stream.resume();
        }
      },
      on: (event: string, handler: (...args: any[]) => void) => emitter.on(event, handler)
    };
  }

  /**
   * Processes the given event and inflates the tarball
   * associated with the event.
   * @param event the event to process.
   * @param destBucket the destination bucket where
   * to inflate the resulting files.
   * @returns a promise which resolves when the
   * process is complete.
   */
  private async inflate(event: CloudEvent, destBucket: string) {
    const pipeline = util.promisify(stream.pipeline);
    const document = event.data().document();
    const extract  = tar.extract();
    const uploads: Promise<any>[] = [];

    // Create a read stream to the archive.
    const readStream = await document.data().asReadStream();

    // Create a listener for each entry in the archive.
    const listener = this.createEntryListener(event, destBucket);

    // We enqueue the promises from the S3 streams
    // into the `uploads` array to be able to wait
    // for the successful writes on the destination bucket.
    listener.on('write-promise', (p: Promise<any>) => uploads.push(p));

    // We listen for each entry in the archive and forward
    // them to the listener which will initiate a write to the
    // destination bucket.
    extract.on('entry', listener.handler);

    // Initiate the pipeline and wait for the
    // stream to be consumed.
    await pipeline(
      readStream,
      gunzip(),
      extract
    );

    // Wait for all the writes to be completed.
    return (Promise.all(uploads));
  }

  /**
   * Inflates the document associated with the record
   * in the target S3 bucket.
   * @param record the SQS record associated with
   * the document to inflate.
   */
  recordHandler(record: SQSRecord): Promise<any> {
    return (this.inflate(
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
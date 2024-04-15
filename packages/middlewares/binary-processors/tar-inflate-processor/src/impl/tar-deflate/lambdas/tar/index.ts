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

import archiver from 'archiver';

import { ArchiverOptions } from 'archiver';
import { randomUUID } from 'crypto';
import { S3Stream, S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { SQSEvent, Context, SQSRecord, SQSBatchResponse } from 'aws-lambda';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { CloudEvent, DataEnvelope, Document, EventType as Type } from '@project-lakechain/sdk/models';
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
const TARGET_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;
const GZIP_ENABLED = process.env.GZIP_ENABLED === 'true';
const COMPRESSION_LEVEL = parseInt(process.env.COMPRESSION_LEVEL as string) ?? 1;

/**
 * The async batch processor processes the received
 * events from SQS in parallel.
 */
const processor = new BatchProcessor(EventType.SQS);

/**
 * The S3 stream helper.
 */
const s3Stream = new S3Stream();

class Lambda implements LambdaInterface {

  /**
   * Called back when the Zip archive has been created.
   * @param uploadResult the upload result.
   * @param size the size of the archive.
   */
  @next()
  private onArchiveCreated(
    result: CompleteMultipartUploadCommandOutput,
    size: number
  ): Promise<CloudEvent> {
    const uri = new S3DocumentDescriptor({
      bucket: result.Bucket!,
      key: result.Key!
    }).asUri();

    // Create the new document referencing the archive.
    const document = new Document.Builder()
      .withUrl(uri)
      .withEtag(result.ETag!.replace(/"/g, ''))
      .withSize(size)
      .withType(this.getOutputType())
      .build();

    // Create the new CloudEvent forwarded to the next middlewares.
    return (Promise.resolve(new CloudEvent.Builder()
      .withId(randomUUID())
      .withType(Type.DOCUMENT_CREATED)
      .withData(new DataEnvelope.Builder()
        .withChainId(randomUUID())
        .withSourceDocument(document)
        .withDocument(document)
        .withMetadata({})
        .build())
      .build()));
  }

  /**
   * Resolves the input documents to process.
   * This function supports both single and composite events.
   * @param event the received event.
   * @returns a promise to an array of CloudEvents to process.
   */
  private async resolveEvents(event: CloudEvent): Promise<CloudEvent[]> {
    const document = event.data().document();

    if (document.mimeType() === 'application/cloudevents+json') {
      const data = JSON.parse((await document
        .data()
        .asBuffer())
        .toString('utf-8')
      );
      return (data.map((event: string) => CloudEvent.from(event)));
    } else {
      return ([event]);
    }
  }

  /**
   * @returns the options to use when creating the tarball.
   */
  private getOpts(): ArchiverOptions {
    if (GZIP_ENABLED) {
      return ({ gzip: true, gzipOptions: { level: COMPRESSION_LEVEL } });
    }
    return ({ gzip: false });
  }

  /**
   * @returns the output type to use when creating the tarball.
   */
  private getOutputType() {
    return (GZIP_ENABLED ? 'application/gzip' : 'application/tar');
  }

  /**
   * @returns the output name to use when creating the tarball.
   */
  private getOutputName() {
    return (GZIP_ENABLED ? 'archive.tar.gz' : 'archive.tar');
  }

  /**
   * Processes the given event and creates a tarball with the documents
   * associated with it into the bucket passed as `destBucket`.
   * @param events the events to process.
   * @param destBucket the destination bucket where
   * to unzip the resulting files.
   * @returns a promise which resolves when the
   * unzip process is complete.
   */
  private async tar(events: CloudEvent[], destBucket: string) {
    const outputKey = `${randomUUID()}/${this.getOutputName()}`;

    // Create a new archiver instance.
    const archive = archiver('tar', this.getOpts());

    // Create a write stream to the destination bucket.
    const { writeStream, promise } = s3Stream.createS3WriteStream({
      bucket: destBucket,
      key: outputKey,
      contentType: this.getOutputType()
    });

    // Pipe the archive to the write stream.
    archive.pipe(writeStream);

    // Append each document read stream to the archive.
    for (const event of events) {
      const document = event.data().document();
      const etag = document.etag();
      const name = `${event.data().chainId()}/${etag}-${document.filename().basename()}`;
      archive.append(
        await document.data().asReadStream(),
        { name }
      );
    }

    // Wait for the process to complete.
    await archive.finalize();
    const res = await promise;
    
    // Forward the document to the next middlewares.
    return (this.onArchiveCreated(res, archive.pointer()));
  }

  /**
   * Deflates the document associated with the record
   * in the target S3 bucket.
   * @param record the SQS record associated with
   * the document to inflate.
   */
  async recordHandler(record: SQSRecord): Promise<any> {
    return (this.tar(
      await this.resolveEvents(CloudEvent.from(JSON.parse(record.body))),
      TARGET_BUCKET
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
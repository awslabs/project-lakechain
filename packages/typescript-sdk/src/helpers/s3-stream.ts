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

import { PassThrough, Readable } from 'stream';
import { Upload } from '@aws-sdk/lib-storage';
import { tracer } from '../powertools/index.js';
import {
  S3Client,
  GetObjectCommand,
  AbortMultipartUploadCommandOutput,
  CompleteMultipartUploadCommandOutput,
  PutObjectCommandInput
} from '@aws-sdk/client-s3';

export interface ObjectInput {

  /**
   * The S3 bucket to read from.
   */
  readonly bucket: string;

  /**
   * The S3 object to read from.
   */
  readonly key: string;

  /**
   * The content type of the object.
   */
  readonly contentType?: string;
}

export class S3Stream {

  /**
   * The S3 client to use.
   */
  private s3: S3Client;

  /**
   * A helper class to read and write to S3 using
   * streams.
   * @param {*} region the AWS region to use.
   */
  constructor(opts = { region: process.env.AWS_REGION }) {
    this.s3 = tracer.captureAWSv3Client(new S3Client({
      region: opts.region,
      maxAttempts: 5
    }));
  }

  /**
   * @param input represents a bucket, key, and content type tuple.
   * @returns a read stream to the given S3 object.
   */
  async createS3ReadStream(input: ObjectInput): Promise<Readable> {
    const result = await this.s3.send(new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.key
    }));
    return (result.Body as Readable);
  }

  /**
   * Creates a write stream to the given S3 object.
   * @param input represents a bucket, key, and content type tuple.
   * @returns an object containing the write stream and a promise
   * which resolves when the write stream has finished.
   */
  createS3WriteStream(input: ObjectInput, opts?: Partial<PutObjectCommandInput>): {
    writeStream: PassThrough,
    promise: Promise<
      AbortMultipartUploadCommandOutput
      | CompleteMultipartUploadCommandOutput
    >
   } {
    const stream = new PassThrough();

    const promise = new Upload({
      client: this.s3,
      params: {
        Bucket: input.bucket,
        Key: input.key,
        Body: stream,
        ContentType: input.contentType,
        ...opts
      },
      leavePartsOnError: false
    }).done();

    return ({ writeStream: stream, promise });
  }
}
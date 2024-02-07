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

import fs from 'fs';
import path from 'path';
import tmp from 'tmp';

import { promisify } from 'util';
import { Readable, pipeline as pipe } from 'stream';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DataSource } from '../data-source.js';
import { tracer } from '../../../../powertools/index.js';
import { S3DocumentDescriptor } from '../../../../helpers/s3-object-descriptor.js';


/**
 * The S3 client instance.
 */
const s3 = tracer.captureAWSv3Client(
  new S3Client({
    region: process.env.AWS_REGION,
    maxAttempts: 5
  })
);

/**
 * Provides a data source implementation for accessing
 * data stored on S3.
 */
export class S3DataSource implements DataSource {

  /**
   * The descriptor containing the information
   * about the S3 object.
   */
  private descriptor: S3DocumentDescriptor;

  /**
   * S3 data source constructor.
   * @param url the URL of the data source.
   */
  constructor(private url: URL) {
    this.descriptor = S3DocumentDescriptor.fromUri(url);
  }

  /**
   * @returns a readable stream to the data source.
   */
  async asReadStream(): Promise<Readable> {
    const res = await s3.send(new GetObjectCommand({
      Bucket: this.descriptor.bucket(),
      Key: this.descriptor.key()
    }));

    if (!res.Body) {
      throw new Error(`Failed to get object from S3: ${this.url}`);
    }

    return (res.Body as Readable);
  }

  /**
   * @returns an array like buffer of the data source.
   * @note this method will buffer the entire content of
   * the data in memory.
   */
  async asArrayBuffer(): Promise<ArrayBufferLike> {
    const res = await s3.send(new GetObjectCommand({
      Bucket: this.descriptor.bucket(),
      Key: this.descriptor.key()
    }));

    if (!res.Body) {
      throw new Error(`Failed to get object from S3: ${this.url}`);
    }

    return ((await res.Body.transformToByteArray()).buffer);
  }

  /**
   * @returns the content of the data pointed by the data
   * source as a buffer.
   * @note this method will buffer the entire content of
   * the data in memory.
   */
  async asBuffer(): Promise<Buffer> {
    const buf    = [];
    const stream = await this.asReadStream();

    // Buffer the stream in memory.
    for await (const data of stream) {
      buf.push(data);
    }
    return (Buffer.concat(buf));
  }

  /**
   * @returns a promise resolved when the content of
   * the data source has been written to the specified
   * file. The promise resolves the path of the
   * output file.
   * @param filePath the path to the file to write to.
   * @note the file path must be absolute.
   */
  async asFile(filePath?: string): Promise<string> {
    const stream   = await this.asReadStream();
    const pipeline = promisify(pipe);

    // If no file path is specified, we create a temporary file.
    if (!filePath) {
      filePath = tmp.fileSync().name;
    }

    // Check if the file name is absolute.
    if (!path.isAbsolute(filePath)) {
      throw new Error(`The file name must be absolute: ${filePath}`);
    }

    // Pipe the stream to the output file.
    await pipeline(
      stream,
      fs.createWriteStream(filePath)
    );
    return (filePath);
  }
}
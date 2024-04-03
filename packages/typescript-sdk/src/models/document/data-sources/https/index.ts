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

import { DataSource } from '../data-source.js';
import { Readable, Writable, pipeline as pipe } from 'stream';
import { promisify } from 'util';
import { FetchReadable } from './fetch-readable.js';

/**
 * Provides a data source implementation for accessing
 * data stored over HTTPS.
 */
export class HttpsDataSource implements DataSource {

  /**
   * HTTPS data source constructor.
   * @param url the URL of the data source.
   */
  constructor(private url: URL) {
    this.url = url;
  }

  /**
   * @returns a readable stream to the data source.
   */
  async asReadStream(): Promise<Readable> {
    const res = await fetch(this.url.toString());

    if (!res.ok || !res.body) {
      throw new Error(`Failed to get object from HTTPS: ${this.url}`);
    }

    return (new FetchReadable(res.body));
  }

  /**
   * @returns a writable stream to the data source.
   */
  asWriteStream(): Writable {
    throw new Error('Writable streams are not supported for HTTPS data sources');
  }

  /**
   * @returns an array like buffer of the data source.
   * @note this method will buffer the entire content of
   * the data in memory.
   */
  async asArrayBuffer(): Promise<ArrayBufferLike> {
    const res = await fetch(this.url.toString());

    if (!res.ok || !res.body) {
      throw new Error(`Failed to get object from HTTPS: ${this.url}`);
    }

    return (await res.arrayBuffer());
  }

  /**
   * @returns the content of the data pointed by the data
   * source as a buffer.
   * @note this method will buffer the entire content of
   * the data in memory.
   */
  async asBuffer(): Promise<Buffer> {
    return (Buffer.from(await this.asArrayBuffer()));
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
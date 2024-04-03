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

import { Readable, Writable } from 'stream';

export interface DataSource {

  /**
   * @returns a readable stream from the data source.
   */
  asReadStream(): Promise<Readable>;

  /**
   * @returns a writable stream to the data source.
   */
  asWriteStream(obj?: any): Writable;

  /**
   * @returns an array like buffer from the data source.
   */
  asArrayBuffer(): Promise<ArrayBufferLike>;

  /**
   * @returns a buffer from the data source.
   */
  asBuffer(): Promise<Buffer>;

  /**
   * @returns a promise resolved when the content of
   * the data source has been written to the specified
   * file. The promise resolves the path of the
   * output file.
   * @param filePath the path of the file to write to.
   * @note the file path must be absolute.
   */
  asFile(filePath?: string): Promise<string>;
}

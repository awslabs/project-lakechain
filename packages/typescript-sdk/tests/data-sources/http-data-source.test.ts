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

import fs from 'node:fs';
import assert from 'node:assert';

import { describe, it } from 'node:test';
import { createDataSource } from '../../src/index.js';
import { Readable } from 'node:stream';

/**
 * A helper function that buffers a readable stream in memory.
 * @param stream the readable stream to buffer.
 * @returns a promise resolved with the buffer.
 */
const readStreamInMemory = async (stream: Readable) => {
  const chunks: any[] = [];
  for await (const chunk of stream) {
      chunks.push(chunk);
  }
  return (Buffer.concat(chunks));
};

const ref = {
  "userId": 1,
  "id": 1,
  "title": "delectus aut autem",
  "completed": false
};

describe('HTTPS Data Source', () => {

  /**
   * HTTPS URL creation from a URL object.
   */
  it('should be able to create a data source from an HTTPS URL', () => {
    const dataSource = createDataSource(new URL('https://example.com/foo'));
    assert.ok(dataSource);
  });

  /**
   * HTTPS URL creation from a string.
   */
  it('should be able to create a data source from an HTTPS URL string', () => {
    const dataSource = createDataSource('https://example.com/foo');
    assert.ok(dataSource);
  });

  /**
   * HTTPS URL creation from an invalid string.
   */
  it('should not be able to create a data source from an invalid HTTPS URL string', () => {
    assert.throws(() => createDataSource('test'));
  });

  /**
   * HTTPS read stream test.
   */
  it('should be able to read from an HTTPS read stream', async () => {
    const dataSource = createDataSource(new URL('https://jsonplaceholder.typicode.com/todos/1'));
    const stream = await dataSource.asReadStream();
    const buffer = await readStreamInMemory(stream);
    const json = JSON.parse(buffer.toString());
    assert.deepEqual(json, ref);
  });

  /**
   * HTTPS read array buffer test.
   */
  it('should be able to read from an S3 data source as an array buffer', async () => {
    const textDecoder = new TextDecoder();
    const dataSource = createDataSource(new URL('https://jsonplaceholder.typicode.com/todos/1'));
    const buffer = await dataSource.asArrayBuffer();
    const decoded = textDecoder.decode(buffer);
    const json = JSON.parse(decoded);
    assert.deepEqual(json, ref);
  });

  /**
   * HTTPS read buffer test.
   */
  it('should be able to read from an S3 data source as a buffer', async () => {
    const dataSource = createDataSource(new URL('https://jsonplaceholder.typicode.com/todos/1'));
    const buffer = await dataSource.asBuffer();
    const json = JSON.parse(buffer.toString());
    assert.deepEqual(json, ref);
  });

  /**
   * HTTPS read file test.
   */
  it('should be able to read from an S3 data source as a file', async () => {
    const dataSource = createDataSource(new URL('https://jsonplaceholder.typicode.com/todos/1'));
    const path = await dataSource.asFile('/tmp/file');
    const data = fs.readFileSync(path);
    const json = JSON.parse(data.toString());
    assert.deepEqual(json, ref);
  });

  /**
   * HTTPS read temporary file test.
   */
  it('should be able to read from an S3 data source as a temporary file', async () => {
    const dataSource = createDataSource(new URL('https://jsonplaceholder.typicode.com/todos/1'));
    const path = await dataSource.asFile();
    const data = fs.readFileSync(path);
    const json = JSON.parse(data.toString());
    assert.deepEqual(json, ref);
  });

  /**
   * HTTPS read error test.
   */
  it('should throw an error when the HTTPS location does not exist', async () => {
    const dataSource = createDataSource(new URL('https://d1b0a0e0-2f1e-11ec-8d3d-0242ac130003/404'));
    await assert.rejects(dataSource.asReadStream());
  });
});

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

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { Pointer } from '../../src/pointer';
import { CacheStorage } from '../../src/index.js';
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';
import { Readable } from 'node:stream';

describe('Cache Storage', () => {

  /**
   * Missing parameters test.
   */
  it('should not be able to create a new instance without the appropriate parameters', () => {
    assert.throws(() => new CacheStorage());

    assert.throws(() => {
      new CacheStorage({
        bucketName: '',
        serviceName: ''
      });
    });
  });

  /**
   * Valid parameters test.
   */
  it('should be able to create a new instance with the appropriate parameters', () => {
    new CacheStorage({
      bucketName: 'lakechain-cache-storage',
      serviceName: 'test'
    });
  });

  /**
   * Object insertion test.
   */
  it('should be able to put an object in the cache', async () => {
    const s3Mock = mockClient(S3Client);
    const obj    = {
      userId: 1,
      id: 1,
      title: 'test',
      completed: false
    };

    // Mock the S3 client.
    s3Mock
      .on(PutObjectCommand).resolves({})
      .on(GetObjectCommand).resolves({
        Body: sdkStreamMixin(Readable.from(Buffer.from(JSON.stringify(obj)))),
        ContentType: 'text/plain'
      });

    const cacheStorage = new CacheStorage({
      bucketName: 'lakechain-cache-storage',
      serviceName: 'test'
    });

    // Put an element in the cache.
    const pointer = await cacheStorage.put('test', obj);

    // Verify that the pointer is valid.
    assert.equal(pointer instanceof Pointer, true);
    // Verify that the pointer points to the right value.
    assert.deepEqual(await pointer.resolve(), obj);
  });

  /**
   * Native types insertion test.
   */
  it('should be able to put a native type in the cache', async () => {
    const s3Mock = mockClient(S3Client);
    const values = [ 'test', 1, 1.0 ];

    for (const value of values) {
      s3Mock
        .on(PutObjectCommand).resolves({})
        .on(GetObjectCommand).resolves({
          Body: sdkStreamMixin(Readable.from(Buffer.from(JSON.stringify(value)))),
          ContentType: 'text/plain'
        });

      const cacheStorage = new CacheStorage({
        bucketName: 'lakechain-cache-storage',
        serviceName: 'test'
      });

      // Put an element in the cache.
      const pointer = await cacheStorage.put('test', value);

      // Verify that the pointer is valid.
      assert.equal(pointer instanceof Pointer, true);
      // Verify that the pointer points to the right value.
      assert.deepEqual(await pointer.resolve(), value);
    }
  });
});
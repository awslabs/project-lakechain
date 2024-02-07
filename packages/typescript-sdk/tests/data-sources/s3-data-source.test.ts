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
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, GetObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';

describe('S3 Data Source', () => {

  /**
   * S3 URL data source creation.
   */
  it('should be able to create a data source from an S3 URL', () => {
    const dataSource = createDataSource(new URL('s3://bucket/key'));
    assert.ok(dataSource);
  });

  /**
   * S3 URL read stream test.
   */
  it('should be able to read from an S3 data source', async () => {
    const s3Mock = mockClient(S3Client);

    s3Mock.on(GetObjectCommand).resolves({
      Body: sdkStreamMixin(Readable.from(Buffer.from('Hello World!'))),
      ContentType: 'text/plain'
    });

    const dataSource = createDataSource(new URL('s3://bucket/key'));
    const stream = await dataSource.asReadStream();
    assert.equal(stream.read().toString(), 'Hello World!');
  });

  /**
   * S3 URL array buffer read test.
   */
  it('should be able to read from an S3 data source as an array buffer', async () => {
    const s3Mock = mockClient(S3Client);

    s3Mock.on(GetObjectCommand).resolves({
      Body: sdkStreamMixin(Readable.from(Buffer.from('Hello World!'))),
      ContentType: 'text/plain'
    });

    const dataSource = createDataSource(new URL('s3://bucket/key'));
    const buffer = await dataSource.asArrayBuffer();
    assert.equal(Buffer.from(buffer).toString(), 'Hello World!');
  });

  /**
   * S3 URL buffer read test.
   */
  it('should be able to read from an S3 data source as a buffer', async () => {
    const s3Mock = mockClient(S3Client);

    s3Mock.on(GetObjectCommand).resolves({
      Body: sdkStreamMixin(Readable.from(Buffer.from('Hello World!'))),
      ContentType: 'text/plain'
    });

    const dataSource = createDataSource(new URL('s3://bucket/key'));
    const buffer = await dataSource.asBuffer();
    assert.equal(buffer.toString(), 'Hello World!');
  });

  /**
   * S3 URL file read test.
   */
  it('should be able to read from an S3 data source as a file', async () => {
    const s3Mock = mockClient(S3Client);

    s3Mock.on(GetObjectCommand).resolves({
      Body: sdkStreamMixin(Readable.from(Buffer.from('Hello World!'))),
      ContentType: 'text/plain'
    });

    const dataSource = createDataSource(new URL('s3://bucket/key'));
    const path = await dataSource.asFile('/tmp/file');
    const data = fs.readFileSync(path);
    assert.equal(path, '/tmp/file');
    assert.equal(data.toString(), 'Hello World!');
  });

  /**
   * S3 URL temporary file read test.
   */
  it('should be able to read from an S3 data source as a temporary file', async () => {
    const s3Mock = mockClient(S3Client);

    s3Mock.on(GetObjectCommand).resolves({
      Body: sdkStreamMixin(Readable.from(Buffer.from('Hello World!'))),
      ContentType: 'text/plain'
    });

    const dataSource = createDataSource(new URL('s3://bucket/key'));
    const path = await dataSource.asFile();
    const data = fs.readFileSync(path);
    assert.equal(data.toString(), 'Hello World!');
  });

  /**
   * S3 URL read error test.
   */
  it('should throw an error when the S3 object does not exist', async () => {
    const s3Mock = mockClient(S3Client);

    s3Mock.on(GetObjectCommand).rejects(
      new NoSuchKey({
        $metadata: {
          httpStatusCode: 404
        },
        message: 'NoSuchKey'
      })
    );

    const dataSource = createDataSource(new URL('s3://bucket/key'));
    await assert.rejects(dataSource.asReadStream(), {
      name: 'NoSuchKey'
    });
  });
});

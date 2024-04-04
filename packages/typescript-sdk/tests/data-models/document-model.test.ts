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
import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, UploadPartCommand, CreateMultipartUploadCommand, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { Document } from '../../src/models/document/document.js';

describe('Document Data Model', () => {

  /**
   * Document construction from a minimal set of properties.
   */
  it('should be able to create a minimal document', () => {
    const document = new Document.Builder()
      .withType('text/plain')
      .withUrl('s3://example.com/test.txt')
      .build();

    assert.strictEqual(document.mimeType(), 'text/plain');
    assert.strictEqual(document.filename().basename(), 'test.txt');
    assert.strictEqual(document.url().toString(), 's3://example.com/test.txt');
    assert.equal(typeof document.id(), 'string');
  });

  /**
   * Document construction from a complete set of properties.
   */
  it('should be able to create a complete document', () => {
    const document = new Document.Builder()
      .withType('application/json')
      .withEtag('ed076287532e86365e841e92bfc50d8c')
      .withSize(100)
      .withUrl('s3://example.com/test')
      .build();

    assert.strictEqual(document.mimeType(), 'application/json');
    assert.strictEqual(document.filename().basename(), 'test');
    assert.strictEqual(document.url().toString(), 's3://example.com/test');
    assert.strictEqual(document.etag(), 'ed076287532e86365e841e92bfc50d8c');
    assert.strictEqual(document.size(), 100);
    assert.equal(typeof document.id(), 'string');
  });

  /**
   * Document construction from an invalid set of properties.
   */
  it('should not be able to create an empty document', () => {
    assert.throws(() => {
      new Document.Builder().build();
    });
  });

  /**
   * Document deserialization.
   */
  it('should be able to deserialize a valid document', () => {
    // Minimalistic document.
    let doc = Document.from({
      type: 'application/json',
      url: 's3://example.com/example.json'
    });
    assert.equal(doc.mimeType(), 'application/json');
    assert.equal(doc.url().toString(), 's3://example.com/example.json');
    assert.equal(typeof doc.etag(), 'undefined');
    assert.equal(typeof doc.size(), 'undefined');

    // Complete document.
    doc = Document.from({
      type: 'application/json',
      url: 's3://example.com/example.json',
      etag: 'test',
      size: 100
    });
    assert.equal(doc.mimeType(), 'application/json');
    assert.equal(doc.url().toString(), 's3://example.com/example.json');
    assert.equal(doc.etag(), 'test');
    assert.equal(doc.size(), 100);
  });

  /**
   * Document deserialization from an invalid object.
   */
  it('should not be able to deserialize an invalid document', () => {
    assert.throws(() => {
      Document.from({});
      Document.from('');
      Document.from({
        type: 'application/json'
      });
    });
  });

  it('should be able to retrieve the file properties of a document', () => {
    const tests = [{
      url: 's3://example.com/test.json',
      extension: '.json',
      name: 'test',
      basename: 'test.json',
      path: '/'
    }, {
      url: 's3://example.com/foo/bar/test.txt',
      extension: '.txt',
      name: 'test',
      basename: 'test.txt',
      path: '/foo/bar'
    }, {
      url: 's3://example.com/foo/bar/test',
      extension: '',
      name: 'test',
      basename: 'test',
      path: '/foo/bar'
    }, {
      url: 's3://example.com/foo/bar/test.',
      extension: '.',
      name: 'test',
      basename: 'test.',
      path: '/foo/bar'
    }, {
      url: 's3://example.com/foo%20bar/test%20(1).json',
      extension: '.json',
      name: 'test (1)',
      basename: 'test (1).json',
      path: '/foo bar'
    }];

    tests.forEach((test) => {
      const document = new Document.Builder()
        .withType('application/json')
        .withEtag('test')
        .withUrl(test.url)
        .build();

      const filename = document.filename();
      assert.equal(filename.extension(), test.extension);
      assert.equal(filename.name(), test.name);
      assert.equal(filename.path(), test.path);
      assert.equal(filename.basename(), test.basename);
    });
  });

  it('should be able to create a new document using a buffer', async () => {
    const s3Mock = mockClient(S3Client);
    const buffer = Buffer.from('Hello');
    const url    = 's3://test/foo.txt';

    // S3 mocks.
    s3Mock.on(CreateMultipartUploadCommand).resolves({
      UploadId: '1'
    });
    s3Mock.on(UploadPartCommand).resolves({
      ETag: 'test'
    });
    s3Mock.on(CompleteMultipartUploadCommand).resolves({
      Location: url,
      ETag: 'test'
    });

    // Create a new document.
    const document = await Document.create({
      url: url,
      type: 'text/plain',
      data: buffer
    });

    // Verify the document attributes.
    assert.equal(document.url().toString(), url);
    assert.equal(document.mimeType(), 'text/plain');
    assert.equal(document.size(), buffer.length);
  });
});

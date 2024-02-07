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
import assert from 'node:assert';
import mimeTypes from '../../src/lambdas/event-handler/mime-types.json';

import { it, describe, beforeEach } from 'node:test';
import { Readable } from 'stream';
import { mockClient } from 'aws-sdk-client-mock';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';
import { S3Client, GetObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';
import { EventType } from '@project-lakechain/sdk/models';

import {
  InvalidDocumentObjectException,
  ObjectNotFoundException
} from '../../src/lambdas/event-handler/exceptions';
import {
  getDocument,
  mimeTypeFromExtension,
  mimeTypeFromBuffer,
  isDirectory
} from '../../src/lambdas/event-handler/get-document';

// The S3 mocked client.
const s3Mock = mockClient(S3Client);

/**
 * Fixture files to use for testing.
 */
const fixtures = {
  './fixtures/fixture-ffe3.mp3': 'audio/mpeg',
  './fixtures/fixture.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  './fixtures/fixture-minimal.pdf': 'application/pdf',
  './fixtures/fixture2.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

describe('Document Retrieval Module', () => {

  /**
   * Before each test, reset the mock.
   * @see the documentation for the mockClient function.
   */
  beforeEach(() => s3Mock.reset());

  /**
   * Test whether we can infer the mime type from
   * the file name.
   */
  it('should be able to resolve the mime type from a recognized file name', () => {
    const map: { [key: string]: string } = mimeTypes;
    Object.keys(map).forEach((extension) => {
      const type = map[extension];
      assert(mimeTypeFromExtension(`test${extension}`) === type);
    });
  });

  /**
   * Test when there is no mime type associated with
   * the file name.
   */
  it('should not be able to resolve the mime type from a file name without extension', () => {
    assert(typeof mimeTypeFromExtension('test') === 'undefined');
    assert(typeof mimeTypeFromExtension('.bar') === 'undefined');
  });

  /**
   * Invalid file name test.
   */
  it('should not be able to resolve the mime type from an invalid file name', () => {
    assert(typeof mimeTypeFromExtension('') === 'undefined');
    assert(typeof mimeTypeFromExtension('.') === 'undefined');
    assert(typeof mimeTypeFromExtension('....') === 'undefined');
  });

  /**
   * Test whether we can infer the mime type from
   * an S3 object having a valid content type.
   */
  it('should be able to resolve the mime type from an S3 object having a valid mime type', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      ContentType: 'application/pdf'
    });
    const result = await mimeTypeFromBuffer({
      name: 'test-bucket',
    }, { key: 'test', size: 0, eTag: 'test' });
    assert.equal(result, 'application/pdf');
  });

  /**
   * Test whether we can infer the mime type from
   * an S3 object having a default content type and
   * an empty content.
   */
  it('should not be able to resolve the mime type from an S3 object having a default mime type without a buffer', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      ContentType: 'application/octet-stream',
      Body: sdkStreamMixin(
        Readable.from('')
      )
    });
    const result = await mimeTypeFromBuffer({
      name: 'test-bucket',
    }, { key: 'test', size: 0, eTag: 'test' });
    assert(!result);
  });

  it('should be able to resolve the mime type from an S3 object not having a mime type', async () => {
    for (const [fixture, type] of Object.entries(fixtures)) {
      // Mocking the S3 client and using
      // the fixture file as the file stream.
      s3Mock.on(GetObjectCommand).resolves({
        Body: sdkStreamMixin(
          fs.createReadStream(
            path.join(__dirname, fixture)
          )
        )
      });

      // Issuing the request.
      const result = await mimeTypeFromBuffer({
        name: 'test-bucket',
      }, { key: 'test', size: 0, eTag: 'test' });
      assert.equal(result, type);
    }
  });

  /**
   * Directory test.
   */
  it('should be able to determine whether an object is a directory', () => {
    assert(isDirectory('test.pdf', undefined) === false);
    assert(isDirectory('test', undefined) === false);
    assert(isDirectory('test/', undefined) === true);
    assert(isDirectory('/', undefined) === true);
    assert(isDirectory('test', 'application/x-directory') === true);
    assert(isDirectory('test/', 'application/x-directory') === true);
  });

  /**
   * Directory exception test.
   */
  it('should throw an exception if the object is a directory', async () => {
    try {
      s3Mock.on(GetObjectCommand).resolves({
        ContentType: 'application/x-directory'
      });
      await getDocument({ name: 'test-bucket' }, {
        key: 'test', size: 0, eTag: 'test'
      }, EventType.DOCUMENT_CREATED);
      assert(false);
    } catch (e) {
      assert(e instanceof InvalidDocumentObjectException);
    }
  });

  /**
   * Object not found test.
   */
  it('should throw an exception if the object does not exist', async () => {
    try {
      s3Mock.on(GetObjectCommand).callsFake(() => {
        throw new NoSuchKey({
          $metadata: {
            httpStatusCode: 404
          },
          message: 'The specified key does not exist.'
        });
      });
      await getDocument({ name: 'test-bucket' }, {
        key: 'test', size: 0, eTag: 'test'
      }, EventType.DOCUMENT_CREATED);
      assert(false);
    } catch (e) {
      assert(e instanceof ObjectNotFoundException);
    }
  });
});
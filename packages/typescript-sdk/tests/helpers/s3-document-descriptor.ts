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
import { S3DocumentDescriptor } from '../../src/helpers/s3-object-descriptor';

describe('S3 Document Descriptor', () => {

  /**
   * S3 URI parsing.
   */
  it('should be able to create an S3 document descriptor given a URI', () => {
    const tests = [
      { uri: 's3://bucket/key', expected: { bucket: 'bucket', key: 'key' }},
      { uri: 's3://bucket-foo/key-foo', expected: { bucket: 'bucket-foo', key: 'key-foo' }},
      { uri: 's3://bucket/key/with/slashes', expected: { bucket: 'bucket', key: 'key/with/slashes' }},
      { uri: 's3://bucket/key-with-trailing-slash/', expected: { bucket: 'bucket', key: 'key-with-trailing-slash/' }},
      { uri: 's3://bucket-1234/sp%C3%A9cial-%C3%A1-%C3%A9-%C3%AD-%C3%B3-%C3%BA', expected: {
        bucket: 'bucket-1234',
        key: 'spécial-á-é-í-ó-ú'
      }},
      { uri: 's3://bucket/space%20in%20the%20key', expected: {
        bucket: 'bucket',
        key: 'space in the key'
      }},
      { uri: 's3://bucket/key?query=string', expected: {
        bucket: 'bucket',
        key: 'key'
      }},
      { uri: 's3://documentindexpipeline-bucket83908e77-hs0jqisqchq5/Symphony%20No.6%20(1st%20movement).mp3', expected: {
        bucket: 'documentindexpipeline-bucket83908e77-hs0jqisqchq5',
        key: 'Symphony No.6 (1st movement).mp3'
      }}
    ];

    for (const test of tests) {
      // Building from an URI.
      let descriptor = S3DocumentDescriptor.fromUri(test.uri);
      assert.ok(descriptor);
      assert.equal(descriptor.bucket(), test.expected.bucket);
      assert.equal(descriptor.key(), test.expected.key);

      // Using the builder API.
      descriptor = new S3DocumentDescriptor.Builder()
        .withBucket(test.expected.bucket)
        .withKey(test.expected.key)
        .build();
      assert.ok(descriptor);
      assert.equal(descriptor.bucket(), test.expected.bucket);
      assert.equal(descriptor.key(), test.expected.key);
    }
  });

  /**
   * Invalid S3 URIs.
   */
  it('should not be possible to create an S3 document descriptor given an invalid URI', () => {
    const tests = [
      's3://',
      's3://bucket',
      's3://bucket/',
      's3://bucket?key=value'
    ];

    for (const test of tests) {
      assert.throws(() => S3DocumentDescriptor.fromUri(test));
    }
  });

  /**
   * S3 URI serialization.
   */
  it('should be able to serialize an S3 document descriptor to a URI', () => {
    const tests = [
      { bucket: 'bucket', key: 'key', expected: 's3://bucket/key' },
      { bucket: 'bucket-foo', key: 'key-foo', expected: 's3://bucket-foo/key-foo' },
      { bucket: 'bucket', key: 'key/with/slashes', expected: 's3://bucket/key/with/slashes' },
      { bucket: 'bucket', key: 'key-with-trailing-slash/', expected: 's3://bucket/key-with-trailing-slash/' },
      { bucket: 'bucket-1234', key: 'spécial-á-é-í-ó-ú', expected: 's3://bucket-1234/sp%C3%A9cial-%C3%A1-%C3%A9-%C3%AD-%C3%B3-%C3%BA' },
      { bucket: 'bucket', key: 'space in the key', expected: 's3://bucket/space%20in%20the%20key' },
      { bucket: 'documentindexpipeline-bucket83908e77-hs0jqisqchq5', key: 'Symphony No.6 (1st movement).mp3', expected: 's3://documentindexpipeline-bucket83908e77-hs0jqisqchq5/Symphony%20No.6%20(1st%20movement).mp3' }
    ];

    for (const test of tests) {
      const descriptor = new S3DocumentDescriptor({
        bucket: test.bucket,
        key: test.key
      });
      assert.equal(descriptor.asUri().toString(), test.expected);
    }
  });

  /**
   * Invalid URI serialization.
   */
  it('should not be possible to serialize an S3 document descriptor to a URI given invalid information', () => {
    const tests = [
      { bucket: 'bucket', key: '' },
      { bucket: '', key: 'key' },
      { bucket: '', key: '' }
    ];

    for (const test of tests) {
      assert.throws(() => {
        new S3DocumentDescriptor({
          bucket: test.bucket,
          key: test.key
        });
      });
    }
  });

  /**
   * API Transitive test.
   */
  it('should provide a transitive API', () => {
    const tests = [
      's3://bucket/key',
      's3://bucket-foo/key-foo',
      's3://bucket/key/with/slashes',
      's3://bucket/key-with-trailing-slash/',
      's3://bucket-1234/sp%C3%A9cial-%C3%A1-%C3%A9-%C3%AD-%C3%B3-%C3%BA',
      's3://bucket/space%20in%20the%20key',
      's3://documentindexpipeline-bucket83908e77-hs0jqisqchq5/Symphony%20No.6%20(1st%20movement).mp3'
    ];

    for (const test of tests) {
      assert.equal(S3DocumentDescriptor.fromUri(test).asUri().toString(), test);
    }
  });
});
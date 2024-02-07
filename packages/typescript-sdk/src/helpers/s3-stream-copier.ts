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

import { S3DocumentDescriptor, S3Stream } from '.';
import { Document } from '..';

import {
  AbortMultipartUploadCommandOutput,
  CompleteMultipartUploadCommandOutput,
  PutObjectCommandInput
} from '@aws-sdk/client-s3';

/**
 * The builder for the `S3StreamCopier` service.
 */
export class S3StreamCopierBuilder {
  private source: S3DocumentDescriptor;
  private destination: S3DocumentDescriptor;
  private options: Partial<PutObjectCommandInput>;

  /**
   * Specifies the source URI or document to copy.
   * @param source the source document descriptor or document
   * to copy.
   */
  public withSource(source: S3DocumentDescriptor | Document | string) {
    if (source instanceof Document) {
      this.source = S3DocumentDescriptor.fromUri(source.url());
    } else if (typeof source === 'string') {
      this.source = S3DocumentDescriptor.fromUri(source);
    } else {
      this.source = source;
    }
    return (this);
  }

  /**
   * Specifies the destination URI or document to copy
   * the source to.
   * @param destination the destination document descriptor
   * or document to copy.
   */
  public withDestination(destination: S3DocumentDescriptor | Document | string) {
    if (destination instanceof Document) {
      this.destination = S3DocumentDescriptor.fromUri(destination.url());
    } else if (typeof destination === 'string') {
      this.destination = S3DocumentDescriptor.fromUri(destination);
    } else {
      this.destination = destination;
    }
    return (this);
  }

  /**
   * Specifies additional options to pass to the AWS S3 SDK
   * when copying the document.
   * @param opts the options to use when copying the document.
   */
  public withOptions(opts: Partial<PutObjectCommandInput>) {
    this.options = opts;
    return (this);
  }

  /**
   * @returns a new instance of the `S3StreamCopier`
   * service constructed with the given parameters.
   */
  public build(): S3StreamCopier {
    if (!this.source || !this.destination) {
      throw new Error('Invalid S3 stream copier: missing source or destination');
    }
    return (new S3StreamCopier(
      this.source,
      this.destination,
      this.options
    ));
  }
}

export class S3StreamCopier {

  /**
   * The builder for the `S3StreamCopier` service.
   */
  static Builder = S3StreamCopierBuilder;

  constructor(
    private source: S3DocumentDescriptor,
    private destination: S3DocumentDescriptor,
    private options: Partial<PutObjectCommandInput> = {}
  ) {}

  /**
   * Copies the source object to the destination object.
   */
  async copy(): Promise<
    AbortMultipartUploadCommandOutput
    | CompleteMultipartUploadCommandOutput
  > {
    const stream = new S3Stream();

    // The read stream.
    const source = await stream.createS3ReadStream({
      bucket: this.source.bucket(),
      key: this.source.key()
    });

    // The write stream.
    const { writeStream, promise } = stream.createS3WriteStream({
      bucket: this.destination.bucket(),
      key: this.destination.key()
    }, this.options);

    // Pipe the read stream to the write stream.
    source.pipe(writeStream);

    return (promise);
  }
}
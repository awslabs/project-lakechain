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

/**
 * The properties required for creating an
 * S3 document descriptor.
 */
export interface S3DocumentDescriptorProps {
  bucket: string;
  key: string;
}

/**
 * A builder for the `S3DocumentDescriptor` service.
 */
class S3DocumentDescriptorBuilder {
  private props: Partial<S3DocumentDescriptorProps> = {};

  /**
   * @param bucket the S3 bucket name.
   * @returns a new builder for the `S3DocumentDescriptor`
   * service.
   */
  public withBucket(bucket: string) {
    this.props.bucket = bucket;
    return (this);
  }

  /**
   * @param key the S3 object key.
   * @returns a new builder for the `S3DocumentDescriptor`
   * service.
   */
  public withKey(key: string) {
    if (key.slice(1).length === 0) {
      throw new Error(`Invalid S3 object key: ${key}`);
    }
    this.props.key = key;
    return (this);
  }

  /**
   * @returns a new instance of the `S3DocumentDescriptor`
   * service constructed with the given parameters.
   */
  public build(): S3DocumentDescriptor {
    if (!this.props.bucket || !this.props.key) {
      throw new Error('Invalid S3 document descriptor: missing bucket or key');
    }
    return (new S3DocumentDescriptor({
      bucket: this.props.bucket,
      key: this.props.key
    }));
  }
}

/**
 * Describes a document located on S3.
 */
export class S3DocumentDescriptor {

  /**
   * The builder for the `S3DocumentDescriptor` service.
   */
  static Builder = S3DocumentDescriptorBuilder;

  /**
   * @param props the object attributes.
   */
  constructor(private props: S3DocumentDescriptorProps) {
    if (!props.bucket || !props.key) {
      throw new Error('Invalid S3 document descriptor: missing bucket or key');
    }
  }

  /**
   * @returns an S3 object descriptor given an S3 URI.
   * @param uri the S3 URI to parse.
   */
  static fromUri(uri: string | URL): S3DocumentDescriptor {
    const url = uri instanceof URL ? uri : new URL(uri);

    if (url.protocol !== 's3:') {
      throw new Error(`Invalid S3 URI: ${uri}`);
    }

    return (new S3DocumentDescriptor.Builder()
      .withBucket(decodeURIComponent(url.hostname))
      .withKey(decodeURIComponent(url.pathname.slice(1)))
      .build());
  }

  /**
   * @returns a URI describing this S3 object.
   */
  public asUri(): URL {
    // Each parts of the key must be URL-encoded before
    // the keys can be added into the URL.
    const key = this.props.key
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    return new URL(`s3://${encodeURIComponent(this.props.bucket)}/${key}`);
  }

  /**
   * @returns the bucket name.
   */
  public bucket(): string {
    return (this.props.bucket);
  }

  /**
   * @returns the object key.
   */
  public key(): string {
    return (this.props.key);
  }
}

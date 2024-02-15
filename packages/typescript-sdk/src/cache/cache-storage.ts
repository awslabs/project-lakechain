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

import crypto from 'crypto';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { tracer } from '../powertools/index.js';
import { S3DocumentDescriptor } from '../helpers/s3-object-descriptor.js';
import { Pointer, PointerBuilder } from '../pointer';

/**
 * Represents the name of the S3 bucket associated
 * with a middleware cache storage.
 */
const LAKECHAIN_CACHE_STORAGE: string = process.env.LAKECHAIN_CACHE_STORAGE as string;

/**
 * The middleware service name.
 */
const SERVICE_NAME: string =
  process.env.POWERTOOLS_SERVICE_NAME as string ??
  process.env.SERVICE_NAME as string;

/**
 * The S3 client instance.
 */
const s3 = tracer.captureAWSv3Client(
  new S3Client({ region: process.env.AWS_REGION })
);

/**
 * Optional properties for the cache storage.
 */
export interface CacheProps {

  /**
   * The name of the S3 bucket to use as cache storage.
   */
  bucketName: string;

  /**
   * The name of the service using the cache storage.
   */
  serviceName: string;
}

/**
 * The cache storage class provides helper methods to be used
 * by middleware implementations in order to store and retrieve
 * arbitrary data models in and from the storage cache.
 */
export class CacheStorage {

  /**
   * The cache storage properties.
   */
  private props: CacheProps;

  /**
   * Cache storage constructor.
   */
  constructor(props?: CacheProps) {
    this.props = {
      bucketName: props?.bucketName ?? LAKECHAIN_CACHE_STORAGE,
      serviceName: props?.serviceName ?? SERVICE_NAME
    };

    if (!this.props.bucketName) {
      throw new Error(`
        A bucket name is required to initialize the cache storage.
        Either provide a bucket name in the constructor or set the
        LAKECHAIN_CACHE_STORAGE environment variable.
      `);
    }

    if (!this.props.serviceName) {
      throw new Error(`
        A service name is required to initialize the cache storage.
        Either provide a service name in the constructor or set the
        POWERTOOLS_SERVICE_NAME or LAKECHAIN_SERVICE_NAME environment
        variable.
      `);
    }
  }

  /**
   * Hashes the key and data to create a unique
   * and stable identifier for the element in the cache.
   * @param key the key of the element to put
   * in the cache.
   * @param data the data to put in the cache.
   * @returns
   */
  private hash(key: string, data: string) {
    const hash = crypto.createHash('sha256');
    return (hash.update(`${key}-${data}`).digest('hex'));
  }

  /**
   * Inserts a new element in the cache.
   * @param key the key of the element to put
   * in the cache.
   * @param data the data to put in the cache.
   * @returns a pointer to the element in the cache.
   */
  async put<T>(key: string, data: any): Promise<Pointer<T>> {
    let serialized = data;

    // If `data` is an object, we serialize it to JSON.
    if (typeof data === 'object') {
      serialized = JSON.stringify(data);
    }

    // The path where the serialized data will be stored.
    const path = `${this.props.serviceName}/${this.hash(key, data)}`;

    // Create an S3 URI pointing to the location
    // of the serialized data.
    const uri = new S3DocumentDescriptor({
      bucket: this.props.bucketName,
      key: path
    }).asUri();

    // First upload the serialized data to the cache storage.
    await s3.send(new PutObjectCommand({
      Bucket: this.props.bucketName,
      Key: path,
      Body: serialized
    }));

    return (new PointerBuilder<T>()
      .withUri(uri)
      .withClassType(data.constructor)
      .build());
  }
}
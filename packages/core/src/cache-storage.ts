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

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * Properties for the cache storage.
 */
export interface CacheStorageProps {
  removalPolicy?: cdk.RemovalPolicy;
  encryptionKey?: kms.IKey;
}

/**
 * The cache storage provides a construct to build
 * a shared caching layer for middlewares.
 * This allows middlewares to exchange data between
 * them, especially pointers present in the document
 * metadata. It can also be used by middlewares to
 * create a secured internal storage where they can
 * store temporary post-processing data.
 *
 * The cache storage is currently implemented on top
 * of S3, but this construct makes it transparent to the
 * end-user which storage back-end is used.
 */
export class CacheStorage extends Construct {

  /**
   * The cache storage.
   */
  private readonly storage: s3.IBucket;

  /**
   * `CacheStorage` constructor.
   */
  constructor(scope: Construct, id: string, props: CacheStorageProps = {}) {
    super(scope, id);

    // By default, we destroy the cache storage when the stack is destroyed.
    if (!props.removalPolicy) {
      props.removalPolicy = cdk.RemovalPolicy.DESTROY;
    }

    // The cache storage.
    this.storage = new s3.Bucket(this, 'Storage', {
      encryption: props.encryptionKey ?
        s3.BucketEncryption.KMS :
        s3.BucketEncryption.S3_MANAGED,
      encryptionKey: props.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: props.removalPolicy === cdk.RemovalPolicy.DESTROY,
      enforceSSL: true,
      removalPolicy: props.removalPolicy,
      lifecycleRules: [{
        expiration: cdk.Duration.days(1),
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(1)
      }]
    });
  }

  /**
   * @returns the bucket associated with the cache storage.
   */
  public getBucket(): s3.IBucket {
    return (this.storage);
  }

  /**
   * @returns the identifier of the cache storage.
   */
  public id(): string {
    return (this.storage.bucketName);
  }

  /**
   * @returns the KMS key used to encrypt the cache storage.
   */
  public kmsKey(): kms.IKey | undefined {
    return (this.storage.encryptionKey);
  }

  /**
   * Grant read permissions for the cache storage and it's contents to an IAM
   * principal (Role/Group/User).
   *
   * If encryption is used, permission to use the key to decrypt the contents
   * of the cache storage will also be granted to the same principal.
   *
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*'). Parameter type is `any` but `string` should be passed in.
   */
  public grantRead(identity: iam.IGrantable, objectsKeyPattern?: any): iam.Grant {
    return (this.storage.grantRead(identity, objectsKeyPattern));
  }

  /**
   * Grant write permissions to the cache storage to an IAM principal.
   *
   * If encryption is used, permission to use the key to encrypt the contents
   * of written files will also be granted to the same principal.
   *
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*'). Parameter type is `any` but `string` should be passed in.
   */
  public grantWrite(identity: iam.IGrantable, objectsKeyPattern?: any): iam.Grant {
    return (this.storage.grantWrite(identity, objectsKeyPattern));
  }
  
  /**
   * Grant read/write permissions to the cache storage to an IAM principal.
   *
   * If encryption is used, permission to use the key to encrypt/decrypt the contents
   * of the cache storage will also be granted to the same principal.
   *
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*'). Parameter type is `any` but `string` should be passed in.
   */
  public grantReadWrite(identity: iam.IGrantable, objectsKeyPattern?: any): iam.Grant {
    return (this.storage.grantReadWrite(identity, objectsKeyPattern));
  }

  /**
   * Grant delete permissions to the cache storage to an IAM principal.
   * 
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*'). Parameter type is `any` but `string` should be passed in.
   */
  public grantDelete(identity: iam.IGrantable, objectsKeyPattern?: any): iam.Grant {
    return (this.storage.grantDelete(identity, objectsKeyPattern));
  }

  /**
   * Grants s3:PutObject* and s3:Abort* permissions for the bucket associated with
   * the cache storage to an IAM principal.
   *
   * If encryption is used, permission to use the key to encrypt the contents
   * of written files will also be granted to the same principal.
   * 
   * @param identity The principal
   * @param objectsKeyPattern Restrict the permission to a certain key pattern (default '*'). Parameter type is `any` but `string` should be passed in.
   */
  public grantPut(identity: iam.IGrantable, objectsKeyPattern?: any): iam.Grant {
    return (this.storage.grantPut(identity, objectsKeyPattern));
  }
}
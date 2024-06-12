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
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';

import { z } from 'zod';
import { Construct } from 'constructs';
import { LanceDbStorage } from '../storage';

/**
 * Describes the schema for the S3 storage.
 */
const S3StoragePropsSchema = z.object({

  /**
   * A unique identifier for the storage.
   */
  id: z.literal('S3_STORAGE'),

  /**
   * A user provided bucket to use as a storage.
   */
  bucket: z
    .custom<s3.IBucket>((bucket) => {
      if (!bucket) {
        throw new Error('A bucket is required for S3 storage.');
      }
      return (bucket);
    }, {
      message: 'A bucket is required for S3 storage.'
    }),

  /**
   * The path to the LanceDB dataset in the bucket.
   */
  path: z
    .string()
    .default('lancedb/')
});

// The type of the `S3StorageProps` schema.
export type S3StorageProps = z.infer<typeof S3StoragePropsSchema>;

/**
 * The S3 storage builder.
 */
export class S3StorageBuilder {

  /**
   * The construct scope.
   */
  private scope: Construct;

  /**
   * The construct identifier.
   */
  private id: string;

  /**
   * The S3 storage properties.
   */
  private props: Partial<S3StorageProps> = {
    id: 'S3_STORAGE'
  };

  /**
   * Sets the construct scope.
   * @param scope the construct scope.
   */
  public withScope(scope: Construct): S3StorageBuilder {
    this.scope = scope;
    return (this);
  }

  /**
   * Sets the construct identifier.
   * @param id the construct identifier.
   */
  public withIdentifier(id: string): S3StorageBuilder {
    this.id = id;
    return (this);
  }

  /**
   * Sets the path to the LanceDB dataset in the bucket.
   * @param path the path to the LanceDB dataset in the bucket.
   * @returns a reference to the builder.
   */
  public withPath(path: string): S3StorageBuilder {
    this.props.path = path;
    return (this);
  }

  /**
   * Sets the bucket to use as a storage.
   * @param bucket the bucket to use as a storage.
   * @returns a reference to the builder.
   */
  public withBucket(bucket: s3.IBucket): S3StorageBuilder {
    this.props.bucket = bucket;
    return (this);
  }

  /**
   * Builds the S3 storage properties.
   * @returns a new instance of the `S3Storage` class.
   */
  public build(): S3Storage {
    return (S3Storage.from(
      this.scope,
      this.id,
      this.props
    ));
  }
}

/**
 * The S3 storage.
 */
export class S3Storage extends Construct implements LanceDbStorage {

  /**
   * The `S3Storage` Builder.
   */
  public static Builder = S3StorageBuilder;

  /**
   * The S3 bucket.
   */
  public bucketStorage: s3.IBucket;

  /**
   * The DynamoDB table.
   */
  public table: dynamodb.ITable;

  /**
   * Creates a new instance of the `S3Storage` class.
   * @param scope the construct scope.
   * @param resourceId the construct identifier.
   * @param props the task properties.
   */
  constructor(scope: Construct, resourceId: string, public props: S3StorageProps) {
    super(scope, resourceId);

    // Set the bucket.
    this.bucketStorage = props.bucket;

    // Create the DynamoDB table.
    this.table = new dynamodb.Table(this, 'Table', {
      partitionKey: {
        name: 'base_uri',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'version',
        type: dynamodb.AttributeType.NUMBER
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
  }

  /**
   * @returns the storage identifier.
   */
  public id(): string {
    return (this.props.id);
  }

  /**
   * @returns the storage bucket.
   */
  public bucket(): s3.IBucket {
    return (this.bucketStorage);
  }

  /**
   * @returns the storage path.
   */
  public path(): string {
    return (this.props.path);
  }

  /**
   * @returns the storage URI.
   */
  public uri(): string {
    return (`s3+ddb://${this.bucketStorage.bucketName}/${this.path()}?ddbTableName=${this.table.tableName}`);
  }

  /**
   * Grants permissions to an `IGrantable`.
   * @param grantee the grantee to whom permissions should be granted.
   */
  grant(grantee: iam.IGrantable) {
    // Allow the processor to read and write to the DynamoDB table.
    this.table.grantReadWriteData(grantee);
    // Allow the processor to read and write to the S3 bucket.
    this.bucketStorage.grantReadWrite(grantee);
  }

  /**
   * Creates a new instance of the `S3Storage` class.
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @param props the storage properties.
   * @returns a new instance of the `S3Storage` class.
   */
  public static from(scope: Construct, id: string, props: any) {
    return (new S3Storage(scope, id, S3StoragePropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the storage.
   */
  public toJSON() {
    return ({
      id: this.id(),
      path: this.path(),
      uri: this.uri()
    });
  }
}

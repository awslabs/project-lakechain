#!/usr/bin/env node

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

import { Construct } from 'constructs';
import { CacheStorage } from '@project-lakechain/core';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { PandocTextConverter, from } from '@project-lakechain/pandoc-text-converter';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * An example stack showcasing how to use AWS KMS to encrypt
 * a pipeline end-to-end using Lakechain. It uses a specified
 * Customer Managed Key (CMK) to encrypt the data at rest.
 *
 * The pipeline looks as follows:
 *
 * ┌────────────┐   ┌──────────┐   ┌─────────────┐
 * │  S3 Input  ├──►│  Pandoc  ├──►│  S3 Output  │
 * └────────────┘   └──────────┘   └─────────────┘
 *
 */
export class EncryptionPipelineStack extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline using KMS to encrypt a pipeline.',
      ...env
    });

    // The customer managed key (CMK) used to encrypt
    // the storage buckets.
    const bucketKey = new kms.Key(this, 'BucketKey', {
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // The customer managed key (CMK) used to encrypt the data
    // handled by middlewares (i.e SQS queues, SNS topics, local storage).
    const key = new kms.Key(this, 'Key', {
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    ///////////////////////////////////////////
    ///////         S3 Storage          ///////
    ///////////////////////////////////////////

    // The source bucket.
    const source = new s3.Bucket(this, 'Bucket', {
      encryptionKey: bucketKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true
    });

    // The destination bucket.
    const destination = new s3.Bucket(this, 'Destination', {
      encryptionKey: bucketKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true
    });

    // The cache storage.
    const cache = new CacheStorage(this, 'Cache', {
      encryptionKey: key
    });

    ///////////////////////////////////////////
    ///////     Lakechain Pipeline      ///////
    ///////////////////////////////////////////

    // Create the S3 trigger monitoring the bucket
    // for uploaded objects.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(source)
      .withKmsKey(key)
      .build();

    // Convert input documents to specific formats
    // using Pandoc.
    const pandoc = new PandocTextConverter.Builder()
      .withScope(this)
      .withIdentifier('Pandoc')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withKmsKey(key)
      .withConversions(
        from('markdown').to('html'),
        from('docx').to('html')
      )
      .build();

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('Storage')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSource(pandoc)
      .withKmsKey(key)
      .build();

    // Display the source bucket information in the console.
    new cdk.CfnOutput(this, 'SourceBucketName', {
      description: 'The name of the source bucket.',
      value: source.bucketName
    });

    // Display the destination bucket information in the console.
    new cdk.CfnOutput(this, 'DestinationBucketName', {
      description: 'The name of the destination bucket.',
      value: destination.bucketName
    });
  }
}

// Creating the CDK application.
const app = new cdk.App();

// Environment variables.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_DEFAULT_ACCOUNT;
const region  = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new EncryptionPipelineStack(app, 'EncryptionPipelineStack', {
  env: {
    account,
    region
  }
});

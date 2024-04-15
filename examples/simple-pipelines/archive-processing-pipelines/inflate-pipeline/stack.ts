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

import { Construct } from 'constructs';
import { CacheStorage } from '@project-lakechain/core';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { ZipInflateProcessor } from '@project-lakechain/zip-processor';
import { TarInflateProcessor } from '@project-lakechain/tar-processor';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * An simple example stack showcasing how to deflate archives
 * such as ZIP and TAR files from an input bucket into an
 * output bucket.
 *
 * The pipeline looks as follows:
 *
 *                    ┌─────────────────────┐
 *                    │                     │
 *        ┌──────────►│    Unzip Processor  ├────────────────┐
 *        │           │                     │                ▼
 *  ┌─────┴────┐      └─────────────────────┘        ┌──────────────┐
 *  │   S3     │                                     │   S3 Output  │
 *  └─────┬────┘                                     │              │
 *        │           ┌─────────────────────┐        └──────────────┘
 *        │           │                     │                ▲
 *        └──────────►│   Untar Processor   ├────────────────┘
 *                    │                     │
 *                    └─────────────────────┘
 *
 */
export class InflatePipelineStack extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline inflating ZIP and TAR archives.',
      ...env
    });

    ///////////////////////////////////////////
    ///////         S3 Storage          ///////
    ///////////////////////////////////////////

    // The source bucket.
    const source = new s3.Bucket(this, 'Bucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true
    });

    // The destination bucket.
    const destination = new s3.Bucket(this, 'Destination', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true
    });

    // The cache storage.
    const cache = new CacheStorage(this, 'Cache', {});

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
      .build();

    // Unzips ZIP archives.
    const zip = new ZipInflateProcessor.Builder()
      .withScope(this)
      .withIdentifier('UnzipProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // Inflates TAR files.
    const tar = new TarInflateProcessor.Builder()
      .withScope(this)
      .withIdentifier('TarProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSources([zip, tar])
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
new InflatePipelineStack(app, 'InflatePipelineStack', {
  env: {
    account,
    region
  }
});

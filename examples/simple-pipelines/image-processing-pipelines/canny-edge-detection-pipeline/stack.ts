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
import { CannyEdgeDetector } from '@project-lakechain/canny-edge-detector';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * An example stack showcasing how to perform canny edge detection
 * on images.
 *
 * The pipeline looks as follows:
 *
 * ┌──────────────┐    ┌───────────────────────┐    ┌─────────────┐
 * │   S3 Input   ├───►│  Canny Edge Detector  ├───►│  S3 Output  │
 * └──────────────┘    └───────────────────────┘    └─────────────┘
 *
 */
export class CannyEdgeDetectionPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline performing canny edge detection on images.',
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

    // The destination images bucket.
    const destination = new s3.Bucket(this, 'DestinationBucket', {
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

    trigger
      .pipe(
        // Perform canny edge detection on uploaded images
        // and extract the edges.
        new CannyEdgeDetector.Builder()
          .withScope(this)
          .withIdentifier('CannyEdgeDetector')
          .withCacheStorage(cache)
          .withLowerThreshold(100)
          .withUpperThreshold(200)
          .withApertureSize(3)
          .withL2Gradient(false)
          .build()
      )
      .pipe(
        // Write images to the destination bucket.
        new S3StorageConnector.Builder()
          .withScope(this)
          .withIdentifier('DestinationStorageConnector')
          .withCacheStorage(cache)
          .withDestinationBucket(destination)
          .build()
      );

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
new CannyEdgeDetectionPipeline(app, 'CannyEdgeDetectionPipeline', {
  env: {
    account,
    region
  }
});

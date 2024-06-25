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
import { CacheStorage, when } from '@project-lakechain/core';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { LaplacianImageProcessor, Depth } from '@project-lakechain/laplacian-image-processor';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * The threshold value for the Laplacian variance.
 */
const THRESHOLD = 400;

/**
 * An example stack showcasing how to compute the Laplacian
 * variance of images using Project Lakechain.
 *
 * The pipeline looks as follows:
 *
 * ┌──────────────┐    ┌───────────────────────┐    ┌─────────────┐
 * │   S3 Input   ├───►│  Laplacian Processor  ├───►│  S3 Output  │
 * └──────────────┘    └───────────────────────┘    └─────────────┘
 *
 */
export class LaplacianVariancePipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline computing the Laplacian variance of images.',
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

    // The sharp images bucket.
    const sharp = new s3.Bucket(this, 'SharpBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true
    });

    // The blurry images bucket.
    const blurry = new s3.Bucket(this, 'BlurryBucket', {
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

    // Compute the Laplacian variance of the images.
    const laplacian = new LaplacianImageProcessor.Builder()
      .withScope(this)
      .withIdentifier('LaplacianImageProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      // Optionally specify the depth level.
      .withDepth(Depth.CV_64F)
      .build();
  
    // Write the sharp images to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('SharpStorageConnector')
      .withCacheStorage(cache)
      .withSource(laplacian, when('data.metadata.properties.attrs.laplacianVariance').gte(THRESHOLD))
      .withDestinationBucket(sharp)
      .build();

    // Write the blurry images to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('BlurryStorageConnector')
      .withCacheStorage(cache)
      .withSource(laplacian, when('data.metadata.properties.attrs.laplacianVariance').lt(THRESHOLD))
      .withDestinationBucket(blurry)
      .build();

    // Display the source bucket information in the console.
    new cdk.CfnOutput(this, 'SourceBucketName', {
      description: 'The name of the source bucket.',
      value: source.bucketName
    });

    // Display the sharp bucket information in the console.
    new cdk.CfnOutput(this, 'SharpBucketName', {
      description: 'The name of the sharp bucket destination.',
      value: sharp.bucketName
    });

    // Display the blurry bucket information in the console.
    new cdk.CfnOutput(this, 'BlurryBucketName', {
      description: 'The name of the blurry bucket destination.',
      value: blurry.bucketName
    });
  }
}

// Creating the CDK application.
const app = new cdk.App();

// Environment variables.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_DEFAULT_ACCOUNT;
const region  = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new LaplacianVariancePipeline(app, 'LaplacianVariancePipeline', {
  env: {
    account,
    region
  }
});

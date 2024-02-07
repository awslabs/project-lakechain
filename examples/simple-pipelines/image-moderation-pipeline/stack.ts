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
import { RekognitionImageProcessor, dsl as r } from '@project-lakechain/rekognition-image-processor';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';

/**
 * Example stack for building an image moderation pipeline using
 * the `RekognitionImageProcessor` and conditionals.
 */
export class ImageModerationPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline demonstrating how to classify moderated images.',
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

    // The moderated images bucket.
    const moderated = new s3.Bucket(this, 'Moderated', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true
    });

    // The safe images bucket.
    const safe = new s3.Bucket(this, 'Safe', {
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

    // The Rekognition image processor will
    // identify moderated labels that have a confidence
    // that is at least 90%.
    const rekognition = new RekognitionImageProcessor.Builder()
      .withScope(this)
      .withIdentifier('RekognitionImageProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withIntent(
        r.detect()
          .labels(r.moderate(r.confidence(90)))
      )
      .build();

    // A reference to the moderations counter in the document metadata.
    const subject = 'data.metadata.properties.attrs.stats.moderations';

    // Writes the results to the moderated bucket when
    // moderated labels exist in the image metadata.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('ModeratedStorage')
      .withCacheStorage(cache)
      .withDestinationBucket(moderated)
      // We use a conditional to check whether the moderated
      // counter is greater than 0 to capture moderated images.
      .withSource(rekognition, when(subject).gt(0))
      .build();

    // Writes the results to the safe bucket when moderated
    // labels do not exist in the image metadata.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('SafeStorage')
      .withCacheStorage(cache)
      .withDestinationBucket(safe)
      // We use a conditional to check whether the moderated
      // counter is equal to 0 to capture safe images.
      .withSource(rekognition, when(subject).equals(0))
      .build();

    // Display the source bucket information in the console.
    new cdk.CfnOutput(this, 'SourceBucketName', {
      description: 'The name of the source bucket.',
      value: source.bucketName
    });

    // Display the moderated bucket information in the console.
    new cdk.CfnOutput(this, 'ModeratedBucketName', {
      description: 'The name of the bucket containing moderated images.',
      value: moderated.bucketName
    });

    // Display the safe bucket information in the console.
    new cdk.CfnOutput(this, 'SafeBucketName', {
      description: 'The name of the bucket containing safe images.',
      value: safe.bucketName
    });
  }
}

// Creating the CDK application.
const app = new cdk.App();

// Environment variables.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new ImageModerationPipeline(app, 'ImageModerationPipeline', {
  env: {
    account,
    region
  }
});

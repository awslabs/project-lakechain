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
import { AudioMetadataExtractor } from '@project-lakechain/audio-metadata-extractor';
import { ImageMetadataExtractor } from '@project-lakechain/image-metadata-extractor';
import { VideoMetadataExtractor } from '@project-lakechain/video-metadata-extractor';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * Example stack for extracting metadata from media files.
 * Images, Audio and Video files are supported.
 * The pipeline looks as follows:
 *
 *
 *                    ┌────────────────────────────┐
 *           ┌───────►│  Audio Metadata Extractor  ├─────────┐
 *           │        └────────────────────────────┘         │
 *           │                                               ▼
 * ┌─────────┴────┐   ┌────────────────────────────┐    ┌────────┐
 * │  S3 Trigger  ├──►│  Image Metadata Extractor  ├───►│   S3   │
 * └─────────┬────┘   └────────────────────────────┘    └────────┘
 *           │                                               ▲
 *           │        ┌────────────────────────────┐         │
 *           └───────►│  Video Metadata Extractor  ├─────────┘
 *                    └────────────────────────────┘
 *
 *
 */
export class MetadataStack extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A simple pipeline extracting metadata from audio, image and video files.',
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

    // Extracts metadata from audio files.
    const audioMetadata = new AudioMetadataExtractor.Builder()
      .withScope(this)
      .withIdentifier('AudioMetadata')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // Extracts metadata from images.
    const imageMetadata = new ImageMetadataExtractor.Builder()
      .withScope(this)
      .withIdentifier('ImageMetadata')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // Extracts metadata from video files.
    const videoMetadata = new VideoMetadataExtractor.Builder()
      .withScope(this)
      .withIdentifier('VideoMetadata')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSources([audioMetadata, imageMetadata, videoMetadata])
      // We ask the S3 storage provider to only copy the resulting
      // document metadata and not the source documents.
      .withCopyDocuments(false)
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
const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new MetadataStack(app, 'MetadataStack', {
  env: {
    account,
    region
  }
});

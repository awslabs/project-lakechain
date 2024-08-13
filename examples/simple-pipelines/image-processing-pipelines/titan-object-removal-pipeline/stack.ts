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
import * as r from '@project-lakechain/core/dsl/vocabulary/reference';

import { Construct } from 'constructs';
import { CacheStorage } from '@project-lakechain/core';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { SharpImageTransform, sharp } from '@project-lakechain/sharp-image-transform';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import {
  TitanImageGenerator,
  ImageInpaintingTask
} from '@project-lakechain/bedrock-image-generators';

/**
 * An example stack showcasing how to perform object removal
 * in images using a semantic prompt with Amazon Titan.
 *
 * The pipeline looks as follows:
 *
 * ┌────────────┐   ┌─────────┐   ┌───────────────────────────┐   ┌─────────────┐
 * │  S3 Input  ├──►│  Sharp  ├──►│  Bedrock Image Generator  ├──►│  S3 Output  │
 * └────────────┘   └─────────┘   └───────────────────────────┘   └─────────────┘
 *
 */
export class TitanObjectRemovalPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline using Amazon Bedrock and Amazon Titan to perform object removal in images.',
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
    // for uploaded images.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(source)
      .build();

    trigger
      .pipe(
        // Ensure the input image dimensions are compatible with the
        // dimensions expected by the Titan model. We resize the image
        // to 1024x1024, and convert it to PNG.
        new SharpImageTransform.Builder()
          .withScope(this)
          .withIdentifier('ImageTransform')
          .withCacheStorage(cache)
          .withSharpTransforms(
            sharp()
              .resize({ width: 1024, height: 1024, fit: 'contain' })
              .png()
          )
          .build()
      )
      .pipe(
        // Remove cats from the image using an inpainting task,
        // and not providing any textual prompt.
        new TitanImageGenerator.Builder()
          .withScope(this)
          .withIdentifier('ImageGenerator')
          .withCacheStorage(cache)
          .withRegion('us-east-1')
          .withTask(new ImageInpaintingTask.Builder()
            .withMaskPrompt('cat')
            .build()
          )
          .build()
      )
      .pipe(
        // Store the generated images in the destination bucket.
        new S3StorageConnector.Builder()
          .withScope(this)
          .withIdentifier('Storage')
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
new TitanObjectRemovalPipeline(app, 'TitanObjectRemovalPipeline', {
  env: {
    account,
    region
  }
});

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
import { SdxlImageGenerator } from '@project-lakechain/bedrock-image-generators';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import { AnthropicTextProcessor, AnthropicTextModel } from '@project-lakechain/bedrock-text-processors';

/**
 * An example stack showcasing how to use Project Lakechain
 * to perform image-to-image transformations using Amazon Bedrock
 * and SDXL.
 *
 * The pipeline looks as follows:
 *
 * ┌────────────┐   ┌───────────────────────┐   ┌────────────────────────┐   ┌─────────────┐
 * │  S3 Input  ├──►│  Anthropic Processor  ├──►│  SDXL Image Processor  ├──►│  S3 Output  │
 * └────────────┘   └───────────────────────┘   └────────────────────────┘   └─────────────┘
 *
 */
export class ImageToImageStack extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline using Amazon Bedrock and SDXL to transform input images.',
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

    // Generates a short description of the image using the
    // Anthropic Claude v3 Haiku multi-modal model.
    const anthropic = new AnthropicTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('Anthropic')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withModel(AnthropicTextModel.ANTHROPIC_CLAUDE_V3_HAIKU)
      .withPrompt(`
        Create a short prompt of one sentence to generate an image similar to the provided image(s).
      `)
      .withModelParameters({
        max_tokens: 256
      })
      .build();

    // Generates new images using SDXL on Amazon Bedrock based on the
    // description of previous images.
    const imageGenerator = new SdxlImageGenerator.Builder()
      .withScope(this)
      .withIdentifier('ImageGenerator')
      .withCacheStorage(cache)
      .withSource(anthropic)
      .withRegion('us-east-1')
      // We use the output of the previous middleware
      // as the prompt for generating new images.
      .withPrompt(r.reference(r.document()))
      .build();

    // Write both the initial image and the generated image
    // to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('Storage')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSources([
        trigger,
        imageGenerator
      ])
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
new ImageToImageStack(app, 'ImageToImageStack', {
  env: {
    account,
    region
  }
});

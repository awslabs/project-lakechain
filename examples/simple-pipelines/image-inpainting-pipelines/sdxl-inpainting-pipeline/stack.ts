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
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as r from '@project-lakechain/core/dsl/vocabulary/reference';

import { Construct } from 'constructs';
import { CacheStorage } from '@project-lakechain/core';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { SharpImageTransform, sharp } from '@project-lakechain/sharp-image-transform';
import { SdxlImageGenerator } from '@project-lakechain/bedrock-image-generators';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * An example stack showcasing how to perform image inpainting
 * using Amazon Bedrock and SDXL.
 *
 * The pipeline looks as follows:
 *
 * ┌────────────┐   ┌─────────┐   ┌───────────────────────────┐   ┌─────────────┐
 * │  S3 Input  ├──►│  Sharp  ├──►│  Bedrock Image Generator  ├──►│  S3 Output  │
 * └────────────┘   └─────────┘   └───────────────────────────┘   └─────────────┘
 *
 */
export class SdxlImageInpainting extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline using Amazon Bedrock and SDXL to perform image inpainting.',
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

    // We upload the mask image in the source S3 bucket under
    // the `mask/` prefix.
    new s3deploy.BucketDeployment(this, 'DeployMask', {
      sources: [s3deploy.Source.asset('./assets/mask/')],
      destinationBucket: source,
      destinationKeyPrefix: 'mask/'
    });

    ///////////////////////////////////////////
    ///////     Lakechain Pipeline      ///////
    ///////////////////////////////////////////

    // Create the S3 trigger monitoring the bucket
    // for uploaded objects in the `images/` prefix.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket({ bucket: source, prefix: 'images/' })
      .build();

    // Ensure the input image dimensions are compatible with the
    // dimensions expected by the SDXL model. We resize the image
    // to 512x512, and convert it to PNG.
    const imageTransform = new SharpImageTransform.Builder()
      .withScope(this)
      .withIdentifier('ImageTransform')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withSharpTransforms(
        sharp()
          .resize(512, 512)
          .png()
      )
      .build();

    // Modify the input images using SDXL on Amazon Bedrock.
    const imageGenerator = new SdxlImageGenerator.Builder()
      .withScope(this)
      .withIdentifier('ImageGenerator')
      .withCacheStorage(cache)
      .withSource(imageTransform)
      // You can override the region to use for Amazon Bedrock.
      // @see https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html#bedrock-regions
      .withRegion('us-east-1')
      .withPrompt('A glowing red cloud')
      .withModelParameters({
        // We reference the input document as the `init_image` parameter.
        init_image: r.reference(r.document()),
        // We reference the mask image as the `mask_image` parameter.
        mask_image: r.reference(
          r.url(`s3://${source.bucketName}/mask/mask.png`)
        ),
        mask_source: 'MASK_IMAGE_BLACK'
      })
      .build();

    // We grant the Bedrock image generator read access to the
    // input bucket, such that it can have access to the mask image.
    source.grantRead(imageGenerator);

    // Write both the resized image and the generated image
    // to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('Storage')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSources([
        imageTransform,
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
new SdxlImageInpainting(app, 'SdxlImageInpainting', {
  env: {
    account,
    region
  }
});

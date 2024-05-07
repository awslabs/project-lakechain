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
import { SharpImageTransform, CloudEvent, SharpFunction } from '@project-lakechain/sharp-image-transform';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * A funclet getting executed in the cloud that extracts the faces
 * part of the incoming image into separate images.
 * @param event the cloud event associated with the image.
 * @param sharp the sharp library function.
 */
const funclet = async function*(event: CloudEvent, sharp: SharpFunction) {
  const metadata = event.data().metadata();

  if (metadata.properties?.kind === 'image') {
    const faces = await metadata.properties.attrs.faces?.resolve();
    const buffer = await event.data().document().data().asBuffer();
    const pipeline = sharp(buffer);
    const dimensions = await pipeline.metadata();

    // Loop over each face to extract it as a separate image
    // using the face bounding box.
    for (const face of faces ?? []) {
      const { width, height, top, left } = face.boundingBox();
      yield sharp(buffer).extract({
        left: Math.floor(left * dimensions.width!),
        top: Math.floor(top * dimensions.height!),
        width: Math.floor(width * dimensions.width!),
        height: Math.floor(height * dimensions.height!)
      }).png();
    }
  }
};

/**
 * An example stack showcasing how to use Project Lakechain
 * to perform face extraction using Amazon Rekognition and
 * the Sharp middleware.
 *
 * The pipeline looks as follows:
 *
 * ┌──────────────┐   ┌─────────────────────────┐   ┌───────────────────┐   ┌─────────────┐
 * │   S3 Input   ├──►│  Rekognition Processor  ├──►│  Sharp Processor  ├──►│  S3 Output  │
 * └──────────────┘   └─────────────────────────┘   └───────────────────┘   └─────────────┘
 *
 */
export class FaceExtractionPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline using computer vision to extract faces from images.',
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

    // The Rekognition image processor will
    // identify faces in processed images.
    const rekognition = new RekognitionImageProcessor.Builder()
      .withScope(this)
      .withIdentifier('Rekognition')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withIntent(
        r.detect()
          .faces(r.confidence(80))
      )
      .build();

    // The face extractor uses a funclet leveraging the Sharp library
    // to yield the faces detected in the image into separate images.
    const faceExtractor = new SharpImageTransform.Builder()
      .withScope(this)
      .withIdentifier('FaceExtractor')
      .withCacheStorage(cache)
      .withSource(rekognition)
      .withSharpTransforms(funclet)
      .build();

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('Storage')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSource(faceExtractor)
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
new FaceExtractionPipeline(app, 'FaceExtractionPipeline', {
  env: {
    account,
    region
  }
});

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
import * as scheduler from '@aws-cdk/aws-scheduler-alpha';

import { Construct } from 'constructs';
import { CacheStorage } from '@project-lakechain/core';
import { SchedulerEventTrigger } from '@project-lakechain/scheduler-event-trigger';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import {
  SdxlImageGenerator,
  TitanImageGenerator,
  TextToImageTask
} from '@project-lakechain/bedrock-image-generators';

/**
 * @returns a date based on the local timezone
 * with a given offset which is by default 5 minutes.
 */
const time = (offset = 5): Date => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + offset);
  return (date);
};

/**
 * An example stack generating images from a single prompt
 * using multiple Bedrock models.
 */
export class ImageGenerationPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline generating images using multiple Bedrock models.',
      ...env
    });

    ///////////////////////////////////////////
    ///////         S3 Storage          ///////
    ///////////////////////////////////////////

    // The destination bucket where results are stored.
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
    ///////         Trigger             ///////
    ///////////////////////////////////////////

    // Schedules the execution of the pipeline 5 minutes
    // after the deployment of the stack.
    const trigger = new SchedulerEventTrigger.Builder()
      .withScope(this)
      .withIdentifier('SchedulerEventTrigger')
      .withCacheStorage(cache)
      .withSchedule(
        scheduler.ScheduleExpression.at(time())
      )
      .build();

    ////////////////////////////////////////////
    ///////   Bedrock Image Generators   ///////
    ////////////////////////////////////////////

    const prompt = 'A cat riding a flying rocket';
    
    // Create new images using SDXL on Amazon Bedrock.
    const sdxlGenerator = new SdxlImageGenerator.Builder()
      .withScope(this)
      .withIdentifier('ImageGenerator')
      .withCacheStorage(cache)
      .withSource(trigger)
      // You can override the region to use for Amazon Bedrock.
      // @see https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html#bedrock-regions
      .withRegion('us-east-1')
      .withPrompt(prompt)
      .withNegativePrompts([
        'low resolution',
        'low quality'
      ])
      .build();

    // Create new images using Amazon Titan.
    const amazonGenerator = new TitanImageGenerator.Builder()
      .withScope(this)
      .withIdentifier('TitanImageGenerator')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withRegion('us-east-1')
      .withTask(new TextToImageTask.Builder()
        .withPrompt(prompt)
        .withNegativePrompt('low resolution, low quality')
        .build()
      )
      .build();
    
    ///////////////////////////////////////////
    ///////      Storage Connector      ///////
    ///////////////////////////////////////////

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withSources([
        sdxlGenerator,
        amazonGenerator
      ])
      .withDestinationBucket(destination)
      .build();

    // Display the destination bucket information in the console.
    new cdk.CfnOutput(this, 'DestinationBucketName', {
      description: 'The name of the destination bucket.',
      value: destination.bucketName
    });

    // Display the trigger time in stderr.
    console.error(`💁 The pipeline will be triggered at ${time().toLocaleString()}`);
  }
}

// Creating the CDK application.
const app = new cdk.App();

// Environment variables.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_DEFAULT_ACCOUNT;
const region  = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new ImageGenerationPipeline(app, 'ImageGenerationPipeline', {
  env: {
    account,
    region
  }
});

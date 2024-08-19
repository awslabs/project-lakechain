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
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';

import { Construct } from 'constructs';
import { CacheStorage } from '@project-lakechain/core';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { ElevenLabsSynthesizer } from '@project-lakechain/elevenlabs-synthesizer';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * An example showcasing how to use Project Lakechain to perform
 * text-to-speech transformations using the ElevenLabs API.
 * The pipeline looks as follows:
 *
 * ┌────────────┐   ┌────────────────────┐   ┌────────────────────────┐   ┌───────────┐
 * │ S3 Trigger ├──►│ NLP Text Processor ├──►│ ElevenLabs Synthesizer ├──►│ S3 Output │
 * └────────────┘   └────────────────────┘   └────────────────────────┘   └───────────┘
 *
 * @note You will need to pass the AWS Secrets Manager name of your ElevenLabs
 * API key as an environment variable named `ELEVENLABS_API_KEY_SECRET_NAME`.
 * 
 * For example:
 * ELEVENLABS_API_KEY_SECRET_NAME='elevenlabs/secret' \
 * npm run deploy
 * 
 */
export class ElevenLabsSynthesisPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline converting text to speech using Amazon Polly.',
      ...env
    });

    // Checking whether environment variables are defined.
    if (!process.env.ELEVENLABS_API_KEY_SECRET_NAME) {
      throw new Error(`
        Missing the ELEVENLABS_API_KEY_SECRET_NAME environment variable.
      `);
    }

    // The ElevenLabs API key.
    const elevenLabsApiKey = secrets.Secret.fromSecretNameV2(
      this,
      'ElevenLabsApiKey',
      process.env.ELEVENLABS_API_KEY_SECRET_NAME
    );

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

    // Monitor a bucket for uploaded objects.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(source)
      .build();

    // Convert the text to speech using the ElevenLabs API.
    const synthesizer = new ElevenLabsSynthesizer.Builder()
      .withScope(this)
      .withIdentifier('ElevenLabsSynthesizer')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withApiKey(elevenLabsApiKey)
      // Rachel voice.
      .withVoice('EXAVITQu4vr4xnSDxMaL')
      .build();

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withSource(synthesizer)
      .withDestinationBucket(destination)
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
new ElevenLabsSynthesisPipeline(app, 'ElevenLabsSynthesisPipeline', {
  env: {
    account,
    region
  }
});

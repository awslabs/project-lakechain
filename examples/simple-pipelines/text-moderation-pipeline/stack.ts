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
import { Condition, CloudEvent } from '@project-lakechain/condition';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { NlpTextProcessor, dsl as l } from '@project-lakechain/nlp-text-processor';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import { TextMetadata } from '@project-lakechain/sdk/models/document/metadata';

/**
 * Example stack for moderating documents in a pipeline.
 * The pipeline looks as follows:
 *
 * ┌──────────────┐   ┌─────────────────┐   ┌──────┐
 * │   S3 Input   ├──►│  NLP Processor  ├──►|  S3  │
 * └──────────────┘   └─────────────────┘   └──────┘
 *
 */
export class TextModerationPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline demonstrating how to use Amazon Comprehend for text moderation.',
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

    // The moderated texts bucket.
    const moderated = new s3.Bucket(this, 'Moderated', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true
    });
  
    // The safe texts bucket.
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

    // Monitor a bucket for uploaded objects.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(source)
      .build();

    // The NLP text process will identify PII information
    // and perform sentiment analysis
    const nlpProcessor = new NlpTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('NlpTextProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withIntent(
        l.nlp()
          .language()
          .sentiment()
          .pii(l.confidence(90))
      )
      .build()

    const condition = new Condition.Builder()
      .withScope(this)
      .withIdentifier('Condition')
      .withCacheStorage(cache)
      .withSource(nlpProcessor)
      .withConditional(async (event: CloudEvent) => {
        const metadata = event.data().metadata();
        const attrs = metadata.properties?.attrs as TextMetadata;
        const piis = attrs.stats?.piis;
        const sentiment = attrs.sentiment;
        const has_pii = piis != 0;
        const non_negative_sentiment = sentiment == "positive" || sentiment == "neutral";
        return !has_pii && non_negative_sentiment;
      })
      .build();

    // Writes the results to the moderated bucket when
    // PII labels exist in the document metadata and the
    // sentiment is not positive
    condition.onMismatch(
      new S3StorageConnector.Builder()
        .withScope(this)
        .withIdentifier('ModeratedStorage')
        .withCacheStorage(cache)
        .withDestinationBucket(moderated)
        .build()
    );

    // Writes the results to the safe bucket when PII
    // labels do not exist in the document metadata and
    // the sentiment is positive
    condition.onMatch(
      new S3StorageConnector.Builder()
        .withScope(this)
        .withIdentifier('SafeStorage')
        .withCacheStorage(cache)
        .withDestinationBucket(safe)
        .build()
    );

    // Display the source bucket information in the console.
    new cdk.CfnOutput(this, 'SourceBucketName', {
      description: 'The name of the source bucket.',
      value: source.bucketName
    });
  
    // Display the moderated bucket information in the console.
    new cdk.CfnOutput(this, 'ModeratedBucketName', {
      description: 'The name of the bucket containing moderated documents.',
      value: moderated.bucketName
    });

    // Display the safe bucket information in the console.
    new cdk.CfnOutput(this, 'SafeBucketName', {
      description: 'The name of the bucket containing safe documents.',
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
new TextModerationPipeline(app, 'TextModerationPipeline', {
  env: {
    account,
    region
  }
});

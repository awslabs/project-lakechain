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
import { SyndicationFeedProcessor } from '@project-lakechain/syndication-feed-processor';
import { Newspaper3kParser } from '@project-lakechain/newspaper3k';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * @returns a date based on the local timezone
 * with a given offset which is by default 10 minutes.
 */
const time = (offset = 10): Date => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + offset);
  return (date);
};

/**
 * Example stack for extracting relevant text from HTML
 * articles and extracting their metadata using Newspaper3k.
 * The pipeline looks as follows:
 *
 * ┌─────────────────────┐   ┌───────────────┐   ┌─────────────┐   ┌────┐
 * │  Scheduler Trigger  ├──►│  Feed Parser  ├──►| Newspaper3k |──►| S3 |
 * └─────────────────────┘   └───────────────┘   └─────────────┘   └────┘
 *
 * @see https://newspaper.readthedocs.io/en/latest/
 */
export class ArticleStack extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline converting HTML articles into plain text and extracting their metadata.',
      ...env
    });

    ///////////////////////////////////////////
    ///////         S3 Storage          ///////
    ///////////////////////////////////////////

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

    // The URIs of the feeds to process.
    const uris = [
      'https://aws.amazon.com/blogs/aws/feed/',
      'https://aws.amazon.com/blogs/architecture/feed/'
    ];

    // Schedules the execution of the pipeline 10 minutes
    // after the deployment of the stack.
    const trigger = new SchedulerEventTrigger.Builder()
      .withScope(this)
      .withIdentifier('SchedulerEventTrigger')
      .withCacheStorage(cache)
      .withSchedule(
        scheduler.ScheduleExpression.at(time())
      )
      .withDocuments(uris)
      .build();

    trigger
      // Process the RSS syndication feeds.
      .pipe(
        new SyndicationFeedProcessor.Builder()
          .withScope(this)
          .withIdentifier('SyndicationFeedProcessor')
          .withCacheStorage(cache)
          .build()
      )
      // Parse HTML articles from the feed into plain text.
      .pipe(
        new Newspaper3kParser.Builder()
          .withScope(this)
          .withIdentifier('Newspaper3kParser')
          .withCacheStorage(cache)
          .build()
      )
      // Store the results in S3.
      .pipe(
        new S3StorageConnector.Builder()
          .withScope(this)
          .withIdentifier('StorageConnector')
          .withCacheStorage(cache)
          .withDestinationBucket(destination)
          .build()
      );

    // Display the destination bucket information in the console.
    new cdk.CfnOutput(this, 'DestinationBucketName', {
      description: 'The name of the destination bucket.',
      value: destination.bucketName
    });

    // Display the execution time of the pipeline in the console.
    new cdk.CfnOutput(this, 'ExecutionTime', {
      description: 'The time the pipeline will be executed.',
      value: time().toLocaleString()
    });

    // Display the trigger time in stderr.
    console.error(`💁 The pipeline will be triggered at ${time().toLocaleString()}`);
  }
}

// Creating the CDK application.
const app = new cdk.App();

// Environment variables.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new ArticleStack(app, 'ArticleStack', {
  env: {
    account,
    region
  }
});

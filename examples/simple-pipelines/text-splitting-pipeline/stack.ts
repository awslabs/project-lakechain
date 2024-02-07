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
import { CharacterTextSplitter } from '@project-lakechain/character-text-splitter';
import { RecursiveCharacterTextSplitter } from '@project-lakechain/recursive-character-text-splitter';
import { TilingTextSplitter } from '@project-lakechain/tiling-text-splitter';
import { SentenceTextSplitter } from '@project-lakechain/sentence-text-splitter';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * An example showcasing how to split text using different
 * algorithms. Each text document will be splitted in parallel
 * using different middlewares.
 */
export class TextSplittingStack extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline showcasing how to split text at scale.',
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

    // Creates the character text splitter, which will
    // split the text into chunks of 4000 characters,
    // based on the Langchain `CharacterTextSplitter`
    // implementation.
    const characterTextSplitter = new CharacterTextSplitter.Builder()
      .withScope(this)
      .withIdentifier('CharacterTextSplitter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withChunkSize(4000)
      .withChunkOverlap(200)
      .build();

    // Creates the recursive character text splitter, which will
    // split the text into chunks of up to 4000 characters,
    // based on the Langchain `RecursiveCharacterTextSplitter`
    // implementation.
    const recursiveTextSplitter = new RecursiveCharacterTextSplitter.Builder()
      .withScope(this)
      .withIdentifier('RecursiveCharacterTextSplitter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withChunkSize(4000)
      .withChunkOverlap(200)
      .build();

    // Creates the tiling text splitter, which uses
    // the NLTK tiling algorithm to split the text
    // into paragraphs.
    const tilingTextSplitter = new TilingTextSplitter.Builder()
      .withScope(this)
      .withIdentifier('TilingTextSplitter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // Creates the sentence text splitter, which uses
    // the NLTK sentence tokenizer to split the text
    // into paragraphs of maximum 4000 bytes.
    const sentenceTextSplitter = new SentenceTextSplitter.Builder()
      .withScope(this)
      .withIdentifier('SentenceTextSplitter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withMaxBytesLength(4000)
      .build();

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSources([
        characterTextSplitter,
        recursiveTextSplitter,
        tilingTextSplitter,
        sentenceTextSplitter
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
new TextSplittingStack(app, 'TextSplittingStack', {
  env: {
    account,
    region
  }
});

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
import { TitanEmbeddingProcessor, TitanEmbeddingModel } from '@project-lakechain/bedrock-embedding-processors';
import { LanceDbStorageConnector, S3StorageProvider } from '@project-lakechain/lancedb-storage-connector';
import { SharpImageTransform, sharp } from '@project-lakechain/sharp-image-transform';

/**
 * An example stack showcasing how to use Amazon Bedrock embeddings
 * and Pinecone for storing embeddings.
 * The pipeline looks as follows:
 *
 * ┌──────┐   ┌───────────────┐   ┌────────────────────┐   ┌────────────┐
 * │  S3  ├──►│ Text Splitter ├──►│ Bedrock Embeddings │──►|  Pinecone  │
 * └──────┘   └───────────────┘   └────────────────────┘   └────────────┘
 *
 */
export class BedrockMultimodalPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'An embedding storage pipeline using Amazon Bedrock multimodal embedding models.',
      ...env
    });

    ///////////////////////////////////////////
    ///////         S3 Storage          ///////
    ///////////////////////////////////////////

    // The source bucket where input documents are uploaded.
    const source = new s3.Bucket(this, 'Bucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true
    });

    // The S3 bucket used to store the embeddings.
    const storage = new s3.Bucket(this, 'Storage', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true
    });

    // The cache storage.
    const cache = new CacheStorage(this, 'CacheStorage', {});

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

    trigger
      // Resize images to a width of 512px and convert them to PNG.
      .pipe(
        new SharpImageTransform.Builder()
          .withScope(this)
          .withIdentifier('SharpTransform')
          .withCacheStorage(cache)
          .withSharpTransforms(
            sharp()
              .resize(512)
              .png()
          )
          .build()
      )
      // Creates embeddings for text chunks using Amazon Titan.
      .pipe(
        new TitanEmbeddingProcessor.Builder()
          .withScope(this)
          .withIdentifier('BedrockEmbeddingProcessor')
          .withCacheStorage(cache)
          .withModel(TitanEmbeddingModel.AMAZON_TITAN_EMBED_IMAGE_V1)
          .withRegion('us-east-1')
          .build()
      )
      // Store the embeddings in LanceDB.
      .pipe(
        new LanceDbStorageConnector.Builder()
          .withScope(this)
          .withIdentifier('LanceDbStorageConnector')
          .withCacheStorage(cache)
          .withVectorSize(768)
          .withStorageProvider(new S3StorageProvider.Builder()
            .withScope(this)
            .withIdentifier('S3Storage')
            .withBucket(storage)
            .build())
          .build()
      );

    // Display the source bucket information in the console.
    new cdk.CfnOutput(this, 'SourceBucketName', {
      description: 'The name of the source bucket.',
      value: source.bucketName
    });
  }
}

// Creating the CDK application.
const app = new cdk.App();

// Environment variables.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_DEFAULT_ACCOUNT;
const region  = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new BedrockMultimodalPipeline(app, 'BedrockMultimodalPipeline', {
  env: {
    account,
    region
  }
});

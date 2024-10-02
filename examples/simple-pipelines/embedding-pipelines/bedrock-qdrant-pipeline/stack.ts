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
import { RecursiveCharacterTextSplitter } from '@project-lakechain/recursive-character-text-splitter';
import { TitanEmbeddingProcessor, TitanEmbeddingModel } from '@project-lakechain/bedrock-embedding-processors';
import { QdrantStorageConnector } from '@project-lakechain/qdrant-storage-connector';

/**
 * An example stack showcasing how to use Amazon Bedrock embeddings
 * and Qdrant for storing embeddings.
 * The pipeline looks as follows:
 *
 *
 * ┌──────┐   ┌───────────────┐   ┌────────────────────┐   ┌──────────┐
 * │  S3  ├──►│ Text Splitter ├──►│ Bedrock Embeddings │──►|  Qdrant  │
 * └──────┘   └───────────────┘   └────────────────────┘   └──────────┘
 *
 * @note You will need to pass the AWS Secrets Manager name of your Qdrant
 * API key as an environment variable named `QDRANT_API_KEY_SECRET_NAME`.
 * 
 * For example:
 * QDRANT_API_KEY_SECRET_NAME='qdrant/secret' \
 * npm run deploy
 * 
 */
export class BedrockQdrantPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'An embedding storage pipeline using Amazon Bedrock and Qdrant.',
      ...env
    });

    // Checking whether environment variables are defined.
    if (!process.env.QDRANT_API_KEY_SECRET_NAME) {
      throw new Error(`
        Missing the QDRANT_API_KEY_SECRET_NAME environment variable.
      `);
    }

    const qdrantApiKey = secrets.Secret.fromSecretNameV2(
      this,
      'QdrantApiKey',
      process.env.QDRANT_API_KEY_SECRET_NAME
    );

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

    // We use the `RecursiveCharacterTextSplitter` to split
    // input text into smaller chunks. This is required to ensure
    // that the generated embeddings are relevant.
    const textSplitter = new RecursiveCharacterTextSplitter.Builder()
      .withScope(this)
      .withIdentifier('RecursiveCharacterTextSplitter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withChunkSize(4096)
      .build();

    // Creates embeddings for text chunks using Amazon Titan.
    const embeddingProcessor = new TitanEmbeddingProcessor.Builder()
      .withScope(this)
      .withIdentifier('BedrockEmbeddingProcessor')
      .withCacheStorage(cache)
      .withSource(textSplitter)
      .withModel(TitanEmbeddingModel.AMAZON_TITAN_EMBED_TEXT_V1)
      .withRegion('us-east-1')
      .build();

    // Store the embeddings in Qdrant.
    new QdrantStorageConnector.Builder()
      .withScope(this)
      .withIdentifier('QdrantStorageConnector')
      .withCacheStorage(cache)
      .withSource(embeddingProcessor)
      .withCollectionName('aws')
      .withUrl('https://<example>.cloud.qdrant.io:6333')
      .withApiKey(qdrantApiKey)
      .withStoreText(true)
      .build();

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
new BedrockQdrantPipeline(app, 'QdrantBedrockPipeline', {
  env: {
    account,
    region
  }
});

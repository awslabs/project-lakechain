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
import { MistralTextProcessor, MistralTextModel } from '@project-lakechain/bedrock-text-processors';
import { PdfTextConverter } from '@project-lakechain/pdf-text-converter';
import { PandocTextConverter } from '@project-lakechain/pandoc-text-converter';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * An example showcasing how to use Amazon Bedrock
 * to summarize text using Mistral models on Amazon Bedrock.
 * The pipeline looks as follows:
 *
 *
 *                   ┌──────────────────────┐
 *    ┌─────────────►│  PDF Text Converter  ├───────┐
 *    │              └──────────────────────┘       |
 *    |                                             ▼
 * ┌──────────────┐   ┌────────────────────┐   ┌─────────┐   ┌─────────────┐
 * │   S3 Input   ├──►│  Pandoc Converter  ├──►│ Bedrock ├──►│  S3 Output  │
 * └──────────────┘   └────────────────────┘   └─────────┘   └─────────────┘
 *
 */
export class MistralSummarizationPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline summarizing text documents using Mistral models on Amazon Bedrock.',
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

    // Convert PDF documents to text.
    const pdfConverter = new PdfTextConverter.Builder()
      .withScope(this)
      .withIdentifier('PdfConverter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // Convert text-oriented documents (Docx, Markdown, HTML, etc) to text.
    const pandocConverter = new PandocTextConverter.Builder()
      .withScope(this)
      .withIdentifier('PandocConverter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // We are using the `MistralTextProcessor` component to summarize
    // the input text.
    const textSummarizer = new MistralTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('MistralTextProcessor')
      .withCacheStorage(cache)
      .withSources([
        pdfConverter,
        pandocConverter,
        trigger
      ])
      .withRegion('us-west-2')
      .withModel(MistralTextModel.MISTRAL_LARGE_2)
      .withPrompt('Provide a short summary of the given text')
      .withModelParameters({
        temperature: 0.5,
        maxTokens: 2048
      })
      .build();

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSource(textSummarizer)
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
new MistralSummarizationPipeline(app, 'MistralSummarizationPipeline', {
  env: {
    account,
    region
  }
});

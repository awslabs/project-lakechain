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
import * as r from '@project-lakechain/core/dsl/vocabulary/reference';

import { Construct } from 'constructs';
import { CacheStorage } from '@project-lakechain/core';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { PdfTextConverter } from '@project-lakechain/pdf-text-converter';
import { PandocTextConverter } from '@project-lakechain/pandoc-text-converter';
import { AnthropicTextProcessor, AnthropicTextModel } from '@project-lakechain/bedrock-text-processors';
import { SdxlImageGenerator } from '@project-lakechain/bedrock-image-generators';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * An example stack using Amazon Bedrock to generate images
 * associated with article documents.
 * The pipeline looks as follows:
 * 
 *                   ┌──────────────────────┐
 *    ┌─────────────►│  PDF Text Converter  ├───────┐
 *    │              └──────────────────────┘       |
 *    |                                             ▼
 * ┌──────────────┐   ┌────────────────────┐   ┌───────────┐   ┌────────┐    ┌─────────────┐
 * │   S3 Input   ├──►│  Pandoc Converter  ├──►│ Anthropic ├──►│  SDXL  ├───►│  S3 Output  │
 * └──────────────┘   └────────────────────┘   └───────────┘   └────────┘    └─────────────┘
 *
 */
export class ImageArticlePipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline generating images associated with articles.',
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
    ///////     Lakechain Pipeline      ///////
    ///////////////////////////////////////////

    // Create the S3 trigger monitoring the bucket
    // for uploaded objects in the bucket.
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
    
    // We are using the `AnthropicTextProcessor` component to generate
    // a prompt for image generation given a document.
    const promptGenerator = new AnthropicTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('AnthropicTextProcessor')
      .withCacheStorage(cache)
      .withSources([
        pdfConverter,
        pandocConverter,
        trigger
      ])
      .withRegion('us-east-1')
      .withModel(AnthropicTextModel.ANTHROPIC_CLAUDE_V3_HAIKU)
      .withPrompt(`
        Here is a text document. I want you to generate a one sentence
        prompt used to generate an image associated with this document.
        - Don't specify a description of what is being generated, such as "Here is", or "This is".
        - Just provide the prompt and nothing else.
      `)
      .withModelParameters({
        temperature: 0.5,
        max_tokens: 512
      })
      .build();

    // Create new images for the article using SDXL on Amazon Bedrock.
    const sdxlGenerator = new SdxlImageGenerator.Builder()
      .withScope(this)
      .withIdentifier('ImageGenerator')
      .withCacheStorage(cache)
      .withSource(promptGenerator)
      // You can override the region to use for Amazon Bedrock.
      // @see https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html#bedrock-regions
      .withRegion('us-east-1')
      // We reference the content of the input document as the prompt.
      .withPrompt(r.reference(r.document()))
      .withNegativePrompts([
        'low resolution',
        'low quality'
      ])
      // Customize the style of output images.
      .withModelParameters({
        style_preset: 'digital-art'
      })
      .build();

    // Write both the original document and the end result
    // to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withSources([
        trigger,
        sdxlGenerator
      ])
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
new ImageArticlePipeline(app, 'ImageArticlePipeline', {
  env: {
    account,
    region
  }
});

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
import { AnthropicTextProcessor, AnthropicTextModel } from '@project-lakechain/bedrock-text-processors';
import { PdfTextConverter } from '@project-lakechain/pdf-text-converter';
import { PandocTextConverter } from '@project-lakechain/pandoc-text-converter';
import { SentenceTextSplitter } from '@project-lakechain/sentence-text-splitter';
import { Transform } from '@project-lakechain/transform';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import { concat } from './funclets/concat';
import { conditional } from './funclets/conditional';

import {
  Reducer,
  ConditionalStrategy
} from '@project-lakechain/reducer';

/**
 * The target language for the translation.
 */
const TARGET_LANGUAGE = 'French';

/**
 * Example stack for translating documents using LLMs on Amazon Bedrock.
 */
export class BedrockTranslationPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline demonstrating how to use Amazon Bedrock to translate documents.',
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

    // Monitor a bucket for uploaded objects.
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

    // Split text documents into chunks of maximum 4096 bytes while
    // preserving sentence boundaries.
    // @note This is because a single invocation to a Bedrock model can only
    // output a maximum of 4096 tokens.
    const sentenceTextSplitter = new SentenceTextSplitter.Builder()
      .withScope(this)
      .withIdentifier('SentenceTextSplitter')
      .withCacheStorage(cache)
      .withSources([
        pdfConverter,
        pandocConverter,
        trigger
      ])
      .withMaxBytesLength(4096)
      .build();
    
    // We are using the `AnthropicTextProcessor` component to translate
    // each chunk into the target language.
    const textTranslator = new AnthropicTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('AnthropicTextProcessor')
      .withCacheStorage(cache)
      .withSource(sentenceTextSplitter)
      .withRegion('us-east-1')
      .withModel(AnthropicTextModel.ANTHROPIC_CLAUDE_V3_SONNET)
      .withPrompt(`
        Here is a text that I want you to accurately translate it to ${TARGET_LANGUAGE} while ensuring
        that you translate exactly the entire text, sentence by sentence.
        Do not add any preamble to your output, just output the raw translated text.
      `)
      .withModelParameters({
        temperature: 0,
        max_tokens: 4096
      })
      .build();

    // The reducer middleware will reduce all the translated
    // chunks into a single aggregated document that will be
    // passed to the next middleware.
    const reducer = new Reducer.Builder()
      .withScope(this)
      .withIdentifier('Reducer')
      .withCacheStorage(cache)
      .withSource(textTranslator)
      .withReducerStrategy(new ConditionalStrategy.Builder()
        .withConditional(conditional)
        .build()
      )
      .build();

    // The transform middleware will sort and concatenate all the
    // translated documents into a single text file.
    const transform = new Transform.Builder()
      .withScope(this)
      .withIdentifier('Transform')
      .withCacheStorage(cache)
      .withSource(reducer)
      .withTransformExpression(concat)
      .build();

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSource(transform)
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
const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new BedrockTranslationPipeline(app, 'BedrockTranslationPipeline', {
  env: {
    account,
    region
  }
});

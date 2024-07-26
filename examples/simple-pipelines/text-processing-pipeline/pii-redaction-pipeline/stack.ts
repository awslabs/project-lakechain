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
import { NlpTextProcessor, dsl as l } from '@project-lakechain/nlp-text-processor';
import { PdfTextConverter } from '@project-lakechain/pdf-text-converter';
import { PandocTextConverter } from '@project-lakechain/pandoc-text-converter';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import { TextTransformProcessor, dsl as t } from '@project-lakechain/text-transform-processor';

/**
 * An example showcasing how to build a PII redaction
 * pipeline using Lakechain. It takes text, PDF, Docx
 * documents as an input and outputs PII redacted text:
 *
 *
 *                     ┌──────────────────────┐
 *        ┌───────────►│  PDF Text Converter  ├────────────┐
 *        │            └──────────────────────┘            |
 *        |                                                ▼
 * ┌──────────────┐    ┌────────────────────┐    ┌─────────────────┐   ┌────────────────┐   ┌──────┐
 * │   S3 Input   ├───►│  Pandoc Converter  ├───►│  NLP Processor  ├──►│ Text Transform ├──►│  S3  │
 * └──────────────┘    └────────────────────┘    └─────────────────┘   └────────────────┘   └──────┘
 *        |                                                ▲
 *        |                                                |
 *        └────────────────────────────────────────────────┘
 *
 */
export class PiiRedactionStack extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A PII redaction pipeline using Project Lakechain.',
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

    // Extracts metadata from text documents.
    const nlpProcessor = new NlpTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('NlpProcessor')
      .withCacheStorage(cache)
      .withSources([
        pdfConverter,
        pandocConverter,
        trigger
      ])
      .withIntent(
        l.nlp()
          .language()
          .pii(l.confidence(0.9))
      )
      .build();

    // We use the text transform processor to transform
    // PII data into a redacted format.
    // @see https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html
    const textTransform = new TextTransformProcessor.Builder()
      .withScope(this)
      .withIdentifier('TextTransformProcessor')
      .withCacheStorage(cache)
      .withSource(nlpProcessor)
      .withIntent(
        t.text().redact(t.pii())
      )
      .build();

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSource(textTransform)
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
new PiiRedactionStack(app, 'PiiRedactionStack', {
  env: {
    account,
    region
  }
});

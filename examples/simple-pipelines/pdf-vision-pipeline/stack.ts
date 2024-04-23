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
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import { SharpImageTransform, sharp } from '@project-lakechain/sharp-image-transform';
import { Condition, CloudEvent } from '@project-lakechain/condition';
import { Reducer, TimeWindowStrategy } from '@project-lakechain/reducer';
import { Transform } from '@project-lakechain/transform';
import { concat } from './funclets/transform';

import {
  PdfTextConverter,
  ExtractPagesTask,
  ExtractDocumentTask
} from '@project-lakechain/pdf-text-converter';

/**
 * An example stack using Amazon Bedrock with the PDF processor
 * to build a pipeline accurately transcribing the content of PDF
 * documents into text.
 */
export class PdfVisionPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline converting PDF documents into text.',
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

    // In this step, we extract all the pages from the PDF document,
    // as individual PDF documents.
    // We also enable layout extraction to determine the number of
    // tables and images in the document.
    const pageExtractor = new PdfTextConverter.Builder()
      .withScope(this)
      .withIdentifier('PageExtractor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withMaxMemorySize(2048)
      .withTask(new ExtractPagesTask.Builder()
        .withOutputType('pdf')
        .withLayoutExtraction(true)
        .build()
      )
      .build();

    // This condition determines whether the PDF page contains
    // complex elements such as tables or images.
    const isComplexDocument = new Condition.Builder()
      .withScope(this)
      .withIdentifier('IsComplexDocument')
      .withCacheStorage(cache)
      .withSource(pageExtractor)
      .withConditional(async (event: CloudEvent) => {
        const metadata = event.data().metadata()
        
        if (metadata.properties?.kind === 'text'
          && typeof metadata.properties.attrs?.layout?.tableCount !== 'undefined'
          && typeof metadata.properties.attrs?.layout?.imageCount !== 'undefined'
        ) {
          const layout = metadata.properties.attrs.layout;
          return (layout.tableCount! > 0 || layout.imageCount! > 0);
        }
        return (false);
      })
      .build();

    // This step is used to convert the PDF page into an image if it
    // has been identified as containing complex elements. Tne image
    // will be further passed to the Anthropic image model.
    const pdfToImage = new PdfTextConverter.Builder()
      .withScope(this)
      .withIdentifier('PdfToImage')
      .withCacheStorage(cache)
      .withTask(new ExtractDocumentTask.Builder()
        .withOutputType('image')
        .build()
      )
      .build();

    // The image transform step is used to resize the image
    // and convert it to a JPEG format. This is to ensure that
    // the image is of a small enough size for the Anthropic model.
    const imageTransform = new SharpImageTransform.Builder()
      .withScope(this)
      .withIdentifier('SharpImageTransform')
      .withCacheStorage(cache)
      .withSource(pdfToImage)
      .withSharpTransforms(
        sharp()
          .resize(1024)
          .jpeg()
      )
      .build();

    // This step is used to convert the PDF page into text
    // directly, if it does not contain any complex elements.
    const pdfConverter = new PdfTextConverter.Builder()
      .withScope(this)
      .withIdentifier('PdfConverter')
      .withCacheStorage(cache)
      .withTask(new ExtractDocumentTask.Builder()
        .withOutputType('text')
        .build()
      )
      .build();

    // Condition branch if the document contains complex elements.
    isComplexDocument.onMatch(pdfToImage);

    // Condition branch if the document does not contain complex elements.
    isComplexDocument.onMismatch(pdfConverter);

    // The `AnthropicTextProcessor` is used to generate a markdown
    // representation of the text in the image. This is useful for
    // generating a structured representation of the document when
    // the document contains complex elements.
    const anthropic = new AnthropicTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('AnthropicTextProcessor')
      .withCacheStorage(cache)
      .withRegion('us-east-1')
      .withModel(AnthropicTextModel.ANTHROPIC_CLAUDE_V3_SONNET)
      .withSource(imageTransform)
      .withPrompt(`
        Here is a document associated with a page from a PDF document.
        Your role is to accurately transcribe the pixels of the page into accurate markdown; keep the text untouched.
        Transcribe the content of tables into a structured and formatted markdown table inlined with the text.
        Provide a short caption contextual description for each images inlined with the text.
        Format your output as a clean and readable markdown document.
        Do not say "this document", only output the transcript.
        Skip the preamble; go straight into the transcription.
        In case you cannot transcribe a document, output an empty string, like "".
      `)
      .withModelParameters({
        temperature: 0.1,
        max_tokens: 4096,
        top_p: 0.9,
        top_k: 250
      })
      .build();

    // We reduce all the pages together in a single event within
    // a 6-minutes time window.
    const reducer = new Reducer.Builder()
      .withScope(this)
      .withIdentifier('Reducer')
      .withCacheStorage(cache)
      .withSources([ pdfConverter, anthropic ])
      .withReducerStrategy(new TimeWindowStrategy.Builder()
        .withTimeWindow(cdk.Duration.minutes(6))
        .withJitter(cdk.Duration.seconds(15))
        .build()
      )
      .build();

    // We concatenate all the pages together into a single document.
    const transform = new Transform.Builder()
      .withScope(this)
      .withIdentifier('Concat')
      .withCacheStorage(cache)
      .withSource(reducer)
      .withTransformExpression(concat)
      .build();

    // Write both the result document to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withSource(transform)
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
new PdfVisionPipeline(app, 'PdfVisionPipeline', {
  env: {
    account,
    region
  }
});

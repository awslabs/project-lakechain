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
import { TranscribeAudioProcessor } from '@project-lakechain/transcribe-audio-processor';
import { AnthropicTextProcessor, AnthropicTextModel } from '@project-lakechain/bedrock-text-processors';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * An example showcasing how to perform audio recording
 * summarization using Amazon Transcribe and Amazon Bedrock.
 * The pipeline looks as follows:
 *
 *
 * ┌──────────┐   ┌──────────────────────┐   ┌─────────┐   ┌───────────┐
 * │ S3 Input ├──►│ Transcribe Processor ├──►│ Bedrock ├──►│ S3 Output │
 * └──────────┘   └──────────────────────┘   └─────────┘   └───────────┘
 *
 */
export class AudioRecordingSummarizationStack extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline summarizing audio recordings using Amazon Transcribe and Amazon Bedrock.',
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

    // We are using the `TranscribeAudioProcessor` component to transcribe
    // audio recordings into a VTT file.
    const transcribe = new TranscribeAudioProcessor.Builder()
      .withScope(this)
      .withIdentifier('TranscribeTextProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withOutputFormats('vtt')
      .build();

    // We are using the `AnthropicTextProcessor` component to summarize
    // the input text.
    const textSummarizer = new AnthropicTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('AnthropicTextProcessor')
      .withCacheStorage(cache)
      .withSource(transcribe)
      .withRegion('us-east-1')
      .withModel(AnthropicTextModel.ANTHROPIC_CLAUDE_V3_HAIKU)
      .withPrompt(`
        Give a very detailed summary of the VTT transcription file with the following constraints:
        - Write a verbose and very detailed summary of the transcription in plain text.
        - Keep all the data points of the conversation.
        - Do not say "Here is a summary", just write the summary as is.
        - If you cannot summarize the text, just return an empty string without explanation.
      `)
      .withModelParameters({
        temperature: 0.5,
        max_tokens: 4096
      })
      .build();

    // Write both the transcription and the summarization results
    // to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSources([
        transcribe,
        textSummarizer
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
new AudioRecordingSummarizationStack(app, 'AudioRecordingSummarizationStack', {
  env: {
    account,
    region
  }
});

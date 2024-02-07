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
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import {
  AnthropicTextProcessor,
  AnthropicTextModel,
  CohereTextProcessor,
  CohereTextModel,
  AI21TextProcessor,
  AI21TextModel,
  Llama2TextProcessor,
  Llama2TextModel,
  TitanTextProcessor,
  TitanTextModel
} from '@project-lakechain/bedrock-text-processors';

/**
 * @returns a date based on the local timezone
 * with a given offset which is by default 5 minutes.
 */
const time = (offset = 5): Date => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + offset);
  return (date);
};

/**
 * An example stack generating text from a single prompt
 * using multiple Bedrock models.
 */
export class TextGenerationPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline generating text using multiple Bedrock models.',
      ...env
    });

    ///////////////////////////////////////////
    ///////         S3 Storage          ///////
    ///////////////////////////////////////////

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
    ///////         Trigger             ///////
    ///////////////////////////////////////////

    // Schedules the execution of the pipeline 5 minutes
    // after the deployment of the stack.
    const trigger = new SchedulerEventTrigger.Builder()
      .withScope(this)
      .withIdentifier('SchedulerEventTrigger')
      .withCacheStorage(cache)
      .withSchedule(
        scheduler.ScheduleExpression.at(time())
      )
      .build();

    ///////////////////////////////////////////
    ///////   Bedrock Text Generators   ///////
    ///////////////////////////////////////////

    const subject = 'Cloud computing on AWS';
    const prompt = 'Generate a beautiful poem about the given subject.';
    
    // The Anthropic text processor.
    const anthropic = new AnthropicTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('AnthropicTextProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withRegion('us-east-1')
      .withModel(AnthropicTextModel.ANTHROPIC_CLAUDE_INSTANT_V1)
      .withDocument(subject)
      .withPrompt(prompt)
      .withModelParameters({
        max_tokens_to_sample: 4096
      })
      .build();

    // The Cohere text processor.
    const cohere = new CohereTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('CohereTextProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withRegion('us-east-1')
      .withModel(CohereTextModel.COHERE_COMMAND_TEXT_V14)
      .withDocument(subject)
      .withPrompt(prompt)
      .withModelParameters({
        max_tokens: 4096
      })
      .build();

    // The AI21 text processor.
    const ai21 = new AI21TextProcessor.Builder()
      .withScope(this)
      .withIdentifier('AI21TextProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withRegion('us-east-1')
      .withModel(AI21TextModel.AI21_J2_ULTRA_V1)
      .withDocument(subject)
      .withPrompt(prompt)
      .withModelParameters({
        maxTokens: 8191
      })
      .build();

    // The Llama2 text processor.
    const llama2 = new Llama2TextProcessor.Builder()
      .withScope(this)
      .withIdentifier('Llama2TextProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withRegion('us-east-1')
      .withModel(Llama2TextModel.LLAMA2_70B_CHAT_V1)
      .withDocument(subject)
      .withPrompt(prompt)
      .withModelParameters({
        max_gen_len: 2048
      })
      .build();

    // The Amazon Titan text processor.
    const titan = new TitanTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('TitanTextProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withRegion('us-east-1')
      .withModel(TitanTextModel.AMAZON_TITAN_TEXT_EXPRESS_V1)
      .withDocument(subject)
      .withPrompt(prompt)
      .withModelParameters({
        maxTokenCount: 4096
      })
      .build();
    
    ///////////////////////////////////////////
    ///////      Storage Connector      ///////
    ///////////////////////////////////////////

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withSources([
        anthropic,
        cohere,
        ai21,
        llama2,
        titan
      ])
      .withDestinationBucket(destination)
      .build();

    // Display the destination bucket information in the console.
    new cdk.CfnOutput(this, 'DestinationBucketName', {
      description: 'The name of the destination bucket.',
      value: destination.bucketName
    });

    // Display the trigger time in stderr.
    console.error(`💁 The pipeline will be triggered at ${time().toLocaleString()}`);
  }
}

// Creating the CDK application.
const app = new cdk.App();

// Environment variables.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_DEFAULT_ACCOUNT;
const region  = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new TextGenerationPipeline(app, 'TextGenerationPipeline', {
  env: {
    account,
    region
  }
});

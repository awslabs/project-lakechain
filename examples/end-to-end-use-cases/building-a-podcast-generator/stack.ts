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

import fs from 'fs';
import path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as scheduler from '@aws-cdk/aws-scheduler-alpha';

import { Construct } from 'constructs';
import { CacheStorage, when } from '@project-lakechain/core';
import { SchedulerEventTrigger } from '@project-lakechain/scheduler-event-trigger';
import { AnthropicTextProcessor, AnthropicTextModel } from '@project-lakechain/bedrock-text-processors';
import { PollySynthesizer, dsl as v } from '@project-lakechain/polly-synthesizer';
import { Condition } from '@project-lakechain/condition';
import { SyndicationFeedProcessor } from '@project-lakechain/syndication-feed-processor';
import { Newspaper3kParser } from '@project-lakechain/newspaper3k';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import { FfmpegProcessor } from '@project-lakechain/ffmpeg-processor';
import { Transform } from '@project-lakechain/transform';
import { ffmpegIntent } from './funclets/ffmpeg';
import { filterOut } from './funclets/filter';
import { transformExpression } from './funclets/transform';

import {
  Reducer,
  TimeWindowStrategy
} from '@project-lakechain/reducer';

/**
 * This is the prompt passed to the Claude model to generate
 * the podcast episode.
 */
const prompt = fs.readFileSync(path.join(__dirname, 'prompt.txt'), 'utf-8');

/**
 * An example showcasing how to create a podcast generator
 * that consumes the latest news from an RSS feed and compiles
 * them into a podcast episode every day.
 */
export class PodcastGeneratorStack extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline creating AWS news podcast episodes on the new releases of the day.',
      ...env
    });

    // The VPC in which the FFMPEG processor will be deployed.
    const vpc = this.createVpc('Vpc');

    ///////////////////////////////////////////
    ///////         S3 Storage          ///////
    ///////////////////////////////////////////

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

    // Schedules the execution of the pipeline every 24 hours.
    // The AWS News RSS feed will be forwarded as a document
    // to the pipeline.
    const trigger = new SchedulerEventTrigger.Builder()
      .withScope(this)
      .withIdentifier('SchedulerEventTrigger')
      .withCacheStorage(cache)
      .withSchedule(
        scheduler.ScheduleExpression.rate(cdk.Duration.days(1))
      )
      .withDocuments([
        'https://aws.amazon.com/blogs/aws/feed/'
      ])
      .build();

    // The syndication feed processor will parse the RSS feed
    // associated with the input URL, and create a new document
    // for each feed item.
    const feeds = new SyndicationFeedProcessor.Builder()
      .withScope(this)
      .withIdentifier('SyndicationFeedProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // This condition will filter out all RSS feed items that
    // have not been created today.
    const filter = new Condition.Builder()
      .withScope(this)
      .withIdentifier('Condition')
      .withCacheStorage(cache)
      .withSource(feeds)
      .withConditional(filterOut)
      .build();

    // The newspaper3k parser will extract the relevant text
    // from each HTML document associated with an RSS feed item.
    const parser = new Newspaper3kParser.Builder()
      .withScope(this)
      .withIdentifier('Newspaper3kParser')
      .withCacheStorage(cache)
      .build();
    
    filter.onMatch(parser);

    // The feed reducer will aggregate all parsed text documents
    // from the different RSS feed items into a single event.
    // We use a 15 seconds time window during which we aggregate
    // the feed items.
    const feedReducer = new Reducer.Builder()
      .withScope(this)
      .withIdentifier('FeedReducer')
      .withCacheStorage(cache)
      .withSource(parser)
      .withReducerStrategy(new TimeWindowStrategy.Builder()
        .withTimeWindow(cdk.Duration.seconds(15))
        .withJitter(cdk.Duration.seconds(5))
        .build()
      )
      .build();

    // This step uses Anthropic Claude on Bedrock to generate a
    // podcast story using the aggregated input document containing
    // the text for all gathered blog posts.
    const podcastGenerator = new AnthropicTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('AnthropicTextProcessor')
      .withCacheStorage(cache)
      .withSource(feedReducer)
      .withRegion('us-east-1')
      .withModel(AnthropicTextModel.ANTHROPIC_CLAUDE_V3_SONNET)
      .withPrompt(prompt)
      .withModelParameters({
        temperature: 0.5,
        max_tokens: 4096
      })
      .build();

    // The transform will create a new document containing each
    // voice from the different personas in the podcast episode,
    // with the metadata containing the voice used to synthesize
    // the conversation, and the order of the conversation in the
    // original document.
    const transform = new Transform.Builder()
      .withScope(this)
      .withIdentifier('Transform')
      .withCacheStorage(cache)
      .withSource(podcastGenerator)
      .withTransformExpression(transformExpression)
      .build();

    // The host synthesizer will synthesize the conversations
    // associated with the host using the host voice.
    // Note that longform voices are only available in the us-east-1 region.
    const hostSynthesizer = new PollySynthesizer.Builder()
      .withScope(this)
      .withIdentifier('HostSynthesizer')
      .withCacheStorage(cache)
      .withSource(transform, when('data.metadata.custom.voice').equals('Ruth'))
      .withLanguageOverride('en')
      .withVoiceMapping('en', cdk.Aws.REGION === 'us-east-1' ? v.longform('Ruth') : v.neural('Ruth'))
      .build();

    // The guest synthesizer will synthesize the conversations
    // associated with the guest using the guest voice.
    // Note that longform voices are only available in the us-east-1 region.
    const guestSynthesizer = new PollySynthesizer.Builder()
      .withScope(this)
      .withIdentifier('GuestSynthesizer')
      .withCacheStorage(cache)
      .withSource(transform, when('data.metadata.custom.voice').equals('Gregory'))
      .withLanguageOverride('en')
      .withVoiceMapping('en', cdk.Aws.REGION === 'us-east-1' ? v.longform('Gregory') : v.neural('Gregory'))
      .build();

    // The reducer middleware will aggregate all synthesized voice
    // documents into a single event.
    const voiceReducer = new Reducer.Builder()
      .withScope(this)
      .withIdentifier('PollyReducer')
      .withCacheStorage(cache)
      .withSources([
        hostSynthesizer,
        guestSynthesizer
      ])
      .withReducerStrategy(new TimeWindowStrategy.Builder()
        .withTimeWindow(cdk.Duration.minutes(2))
        .withJitter(cdk.Duration.seconds(10))
        .build()
      )
      .build();

    // The FFMPEG processor will concatenate the audio files
    // generated by the speech synthesizer.
    const ffmpeg = new FfmpegProcessor.Builder()
      .withScope(this)
      .withIdentifier('FfmpegProcessor')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withSource(voiceReducer)
      .withIntent(ffmpegIntent)
      .build();

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSource(ffmpeg)
      .build();

    // Display the destination bucket information in the console.
    new cdk.CfnOutput(this, 'DestinationBucketName', {
      description: 'The name of the destination bucket.',
      value: destination.bucketName
    });
  }

  /**
   * @param id the VPC identifier.
   * @returns a new VPC with a public, private and isolated
   * subnets for the pipeline.
   */
  private createVpc(id: string): ec2.IVpc {
    return (new ec2.Vpc(this, id, {
      enableDnsSupport: true,
      enableDnsHostnames: true,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/20'),
      maxAzs: 1,
      subnetConfiguration: [{
        // Used by NAT Gateways to provide Internet access
        // to the containers.
        name: 'public',
        subnetType: ec2.SubnetType.PUBLIC,
        cidrMask: 28
      }, {
        // Used by the containers.
        name: 'private',
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        cidrMask: 24
      }, {
        // Used by EFS.
        name: 'isolated',
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        cidrMask: 28
      }]
    }));
  }
}

// Creating the CDK application.
const app = new cdk.App();

// Environment variables.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_DEFAULT_ACCOUNT;
const region  = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new PodcastGeneratorStack(app, 'PodcastGeneratorStack', {
  env: {
    account,
    region
  }
});

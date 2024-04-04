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
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import { Construct } from 'constructs';
import { CacheStorage } from '@project-lakechain/core';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { TranscribeAudioProcessor } from '@project-lakechain/transcribe-audio-processor';
import { TranslateTextProcessor, TranslateLanguage } from '@project-lakechain/translate-text-processor';
import { SubtitleProcessor } from '@project-lakechain/subtitle-processor';
import { CloudEvent, Condition } from '@project-lakechain/condition';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import { FfmpegProcessor } from '@project-lakechain/ffmpeg-processor';
import { Transform } from '@project-lakechain/transform';
import { repackageSubtitles } from './funclets/transform';

import {
  audioExtraction,
  merge
} from './funclets/ffmpeg';
import {
  Reducer,
  StaticCounterStrategy
} from '@project-lakechain/reducer';

/**
 * The output languages to translate the subtitles into.
 */
const OUTPUT_LANGUAGES: TranslateLanguage[] = ['en', 'fr', 'ar', 'ja'];

/**
 * An example showcasing how to automatically create multi-lingual
 * subtitles for videos.
 */
export class VideoSubtitlingStack extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline creating multi-lingual subtitles for videos.',
      ...env
    });

    // The VPC in which the FFMPEG processor will be deployed.
    const vpc = this.createVpc('Vpc');

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
    // for uploaded videos.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(source)
      .build();

    // The FFMPEG processor extracts the audio from the video.
    const audioExtractor = new FfmpegProcessor.Builder()
      .withScope(this)
      .withIdentifier('FfmpegProcessor')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withSource(trigger)
      .withIntent(audioExtraction)
      .build();

    // We are using the `TranscribeAudioProcessor` component to transcribe
    // audio into a VTT file.
    const transcribe = new TranscribeAudioProcessor.Builder()
      .withScope(this)
      .withIdentifier('Transcribe')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withSource(audioExtractor)
      .withOutputFormats('srt')
      .build();

    // The subtitle processor will parse the subtitle file produced
    // by the transcribe processor into both plain text, and structured JSON.
    // The plain text version will be passed to the translate middleware.
    const parser = new SubtitleProcessor.Builder()
      .withScope(this)
      .withIdentifier('SubtitleProcessor')
      .withCacheStorage(cache)
      .withSource(transcribe)
      .withOutputFormats('text', 'json')
      .build();

    // Translate the transcriptions into multiple languages.
    const translate = new TranslateTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('Translate')
      .withCacheStorage(cache)
      .withSource(parser)
      .withOutputLanguages(OUTPUT_LANGUAGES)
      .build();

    // This condition ensures that the `reducer` only receives
    // the subtitle JSON description from the `parser`, and not
    // the plain text translation.
    const condition = new Condition.Builder()
      .withScope(this)
      .withIdentifier('Condition')
      .withCacheStorage(cache)
      .withSource(parser)
      .withConditional(async (event: CloudEvent) => {
        return (event.data().document().mimeType() === 'application/json');
      })
      .build();
    
    // The reducer middleware will aggregate the video, translated subtitles,
    // as well as the JSON structured document which maps subtitles
    // to the timing information.
    const reducer = new Reducer.Builder()
      .withScope(this)
      .withIdentifier('Reducer')
      .withCacheStorage(cache)
      .withSources([
        trigger,
        translate
      ])
      .withReducerStrategy(new StaticCounterStrategy.Builder()
        // Input video + JSON subtitle + translations
        .withEventCount(OUTPUT_LANGUAGES.length + 2)
        .build()
      )
      .build();

    // Listen for the JSON description emitted by the subtitle processor.
    condition.onMatch(reducer);

    // The `transform` middleware will re-package the plain text translations
    // into the SRT format.
    const transform = new Transform.Builder()
      .withScope(this)
      .withIdentifier('Transform')
      .withCacheStorage(cache)
      .withSource(reducer)
      .withTransformExpression(repackageSubtitles)
      .build();

    // The FFMPEG processor will merge the subtitles with the video.
    const ffmpeg = new FfmpegProcessor.Builder()
      .withScope(this)
      .withIdentifier('MergeSubtitle')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withSource(transform)
      .withIntent(merge)
      .build();

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSource(ffmpeg)
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
new VideoSubtitlingStack(app, 'VideoSubtitlingStack', {
  env: {
    account,
    region
  }
});

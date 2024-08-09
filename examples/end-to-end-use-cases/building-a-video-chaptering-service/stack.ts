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

import { Construct } from 'constructs';
import { CacheStorage } from '@project-lakechain/core';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { TranscribeAudioProcessor } from '@project-lakechain/transcribe-audio-processor';
import { StructuredEntityExtractor } from '@project-lakechain/structured-entity-extractor';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import { FfmpegProcessor } from '@project-lakechain/ffmpeg-processor';
import { schema } from './schema';

import {
  audioExtraction,
  shorten
} from './funclets/ffmpeg';
import {
  Reducer,
  StaticCounterStrategy
} from '@project-lakechain/reducer';

/**
 * A set of specific instructions to guide the model
 * in extracting structured entities.
 */
const instructions = fs.readFileSync(path.join(__dirname, 'prompt.txt'), 'utf-8');

/**
 * An example showcasing how to extract chapters from
 * input videos.
 */
export class VideoChapteringStack extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline extracting chapters associated with key moments in videos.',
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
      .withOutputFormats('vtt')
      .build();

    // The `StructuredEntityExtractor` component will extract
    // the chapters from the transcribed audio.
    const chapterCreator = new StructuredEntityExtractor.Builder()
      .withScope(this)
      .withIdentifier('StructuredEntityExtractor')
      .withCacheStorage(cache)
      .withRegion('us-east-1')
      .withSource(transcribe)
      .withSchema(schema)
      .withInstructions(instructions)
      .build();

    // The reducer middleware will aggregate the input video
    // and the produced JSON describing the key moments.
    const reducer = new Reducer.Builder()
      .withScope(this)
      .withIdentifier('Reducer')
      .withCacheStorage(cache)
      .withSources([
        trigger,
        chapterCreator
      ])
      .withReducerStrategy(new StaticCounterStrategy.Builder()
        .withEventCount(2)
        .build()
      )
      .build();

    // The FFMPEG processor will extract the chapters
    // as separate videos.
    const ffmpeg = new FfmpegProcessor.Builder()
      .withScope(this)
      .withIdentifier('ChapterExtractor')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withSource(reducer)
      .withIntent(shorten)
      .build();

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSources([
        chapterCreator,
        ffmpeg
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
new VideoChapteringStack(app, 'VideoChapteringStack', {
  env: {
    account,
    region
  }
});

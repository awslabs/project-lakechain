#!/usr/bin/env node

/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with therg  License.
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
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

import { ZipInflateProcessor } from '@project-lakechain/zip-processor';
import { FfmpegProcessor, CloudEvent, FfmpegUtils, Ffmpeg } from '@project-lakechain/ffmpeg-processor';
import { Reducer, TimeWindowStrategy } from '@project-lakechain/reducer';

const VIDEO_MIME_TYPE = 'video/';
const AUDIO_MIME_TYPE = 'audio/';

/**
 * This intent is a function that will get executed in the cloud
 * by the FFMPEG middleware. It takes a video input, multiple
 * audio inputs and combines them into a single video file.
 * the audio from it.
 * @param events the events to process.
 * @param ffmpeg the FFMPEG instance.
 * @param utils a set of utilities to interact with the FFMPEG
 * middleware.
 * @returns the FFMPEG chain.
 */
const intent = async (events: CloudEvent[], ffmpeg: Ffmpeg, utils: FfmpegUtils) => {
  const fileType = (event: CloudEvent) => {
    return {
      isVideo: event.data().document().mimeType().startsWith(VIDEO_MIME_TYPE),
      isAudio: event.data().document().mimeType().startsWith(AUDIO_MIME_TYPE)
    };
  };

  // Extract and parse the metadata from the json file.
  const metadataFile = events
    .filter((event) => event.data().document().filename().extension() === '.json')[0]
    .data()
    .document()
    .data();
  const metadataBuffer = (await metadataFile.asBuffer()).toString('utf-8');
  const metadata: { video: string; tracks: string[] } = JSON.parse(metadataBuffer);

  if (metadata.video.length === 0 || !(Array.isArray(metadata.tracks) && metadata.tracks.length > 0)) {
    throw new Error('The metadata file is not valid');
  }

  // Get the video and audio files.
  const video = events.find(
    (event) => metadata.video === event.data().document().filename().basename() && fileType(event).isVideo
  );
  const tracks = events.filter(
    (event) =>
      metadata.tracks.includes(event.data().document().filename().basename()) && fileType(event).isAudio
  );

  if (video === undefined || tracks.length !== metadata.tracks.length) {
    throw new Error('The files received do not match the metadata');
  }

  // Add the video and audio inputs to the FFMPEG chain.
  let ffmpegInstance = ffmpeg().input(utils.file(video));
  for (const track of tracks) {
    ffmpegInstance = ffmpegInstance.input(utils.file(track));
  }

  // Map the tracks to the output.
  const ffmpegGeneratedOptions = tracks.map((_, i) => `-map ${i + 1}:a`);

  // Return the FFMPEG chain.
  return ffmpegInstance
    .addOption('-map 0')
    .addOptions(ffmpegGeneratedOptions)
    .addOption('-c:v copy')
    .save('output.mp4');
};

/**
 * An example stack showcasing how to use Project Lakechain
 * to add multiple audio tracks to a video using the FFMPEG
 * processor.
 *
 * The pipeline looks as follows:
 *
 * ┌──────────────┐   ┌─────────────────┐   ┌───────────────────┐   ┌─────────────┐
 * │   S3 Input   ├──►│  ZIP Processor  ├──►│  FFMPEG Processor ├──►│  S3 Output  │
 * └──────────────┘   └─────────────────┘   └───────────────────┘   └─────────────┘
 *
 */
export class AudioCombinationPipeline extends cdk.Stack {
  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline using FFMPEG to add multiple audio tracks to a video.',
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
    // for uploaded objects.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(source)
      .build();

    const zipProcessor = new ZipInflateProcessor.Builder()
      .withScope(this)
      .withIdentifier('ZipProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    const reducer = new Reducer.Builder()
      .withScope(this)
      .withIdentifier('Reducer')
      .withCacheStorage(cache)
      .withSource(zipProcessor)
      .withReducerStrategy(
        new TimeWindowStrategy.Builder()
          .withTimeWindow(cdk.Duration.seconds(15))
          .withJitter(cdk.Duration.seconds(5))
          .build()
      )
      .build();

    const ffmpeg = new FfmpegProcessor.Builder()
      .withScope(this)
      .withIdentifier('FfmpegProcessor')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withIntent(intent)
      .withSource(reducer)
      .build();

    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('Storage')
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
    return new ec2.Vpc(this, id, {
      enableDnsSupport: true,
      enableDnsHostnames: true,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/20'),
      maxAzs: 1,
      subnetConfiguration: [
        {
          // Used by NAT Gateways to provide Internet access
          // to the containers.
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 28
        },
        {
          // Used by the containers.
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24
        },
        {
          // Used by EFS.
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 28
        }
      ]
    });
  }
}

// Creating the CDK application.
const app = new cdk.App();

// Environment variables.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new AudioCombinationPipeline(app, 'AudioCombinationPipeline', {
  env: {
    account,
    region
  }
});

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
import { RekognitionImageProcessor, dsl as r } from '@project-lakechain/rekognition-image-processor';
import { ImageLayerProcessor, dsl as l } from '@project-lakechain/image-layer-processor';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';

/**
 * An example stack showcasing how to place a sample pipeline
 * within a private VPC, and use VPC endpoints to enable communication
 * between middlewares and AWS services.
 *
 * The pipeline looks as follows:
 *
 * ┌──────────────┐   ┌─────────────────────────┐   ┌───────────────────┐   ┌─────────────┐
 * │   S3 Input   ├──►│  Rekognition Processor  ├──►│  Image Processor  ├──►│  S3 Output  │
 * └──────────────┘   └─────────────────────────┘   └───────────────────┘   └─────────────┘
 *
 */
export class VpcPrivatePipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline deployed within a private VPC.',
      ...env
    });

    // The VPC in which the EFS cache for the KeyBERT model will be deployed.
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
      .withVpc(vpc)
      .build();

    // The Rekognition image processor will
    // identify faces in processed images.
    const rekognition = new RekognitionImageProcessor.Builder()
      .withScope(this)
      .withIdentifier('Rekognition')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withVpc(vpc)
      .withIntent(
        r.detect()
          .faces(r.confidence(80))
      )
      .build();

    // Create a blurring processor that will blur
    // faces in detected images by the Rekognition processor.
    const layerProcessor = new ImageLayerProcessor.Builder()
      .withScope(this)
      .withIdentifier('ImageLayer')
      .withCacheStorage(cache)
      .withSource(rekognition)
      .withVpc(vpc)
      .withLayers(
        l.pixelate(l.faces()),
        l.highlight(l.landmarks())
      )
      .build();

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('Storage')
      .withCacheStorage(cache)
      .withDestinationBucket(destination)
      .withSource(layerProcessor)
      .withVpc(vpc)
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
    const vpc = new ec2.Vpc(this, id, {
      enableDnsSupport: true,
      enableDnsHostnames: true,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/20'),
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [{
        // Used by KeyBERT containers.
        name: 'private',
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        cidrMask: 24
      }]
    });

    // Add a CloudWatch VPC endpoint to the VPC.
    vpc.addInterfaceEndpoint('CloudWatchEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS
    });

    // Add an S3 VPC endpoint to the VPC.
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3
    });

    // Add an SQS VPC endpoint to the VPC.
    vpc.addInterfaceEndpoint('SQSEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SQS
    });

    // Add an SNS VPC endpoint to the VPC.
    vpc.addInterfaceEndpoint('SNSEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SNS
    });

    // Add a Rekognition VPC endpoint to the VPC.
    vpc.addInterfaceEndpoint('RekognitionEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.REKOGNITION
    });

    return (vpc);
  }
}

// Creating the CDK application.
const app = new cdk.App();

// Environment variables.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_DEFAULT_ACCOUNT;
const region  = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new VpcPrivatePipeline(app, 'VpcPrivatePipeline', {
  env: {
    account,
    region
  }
});

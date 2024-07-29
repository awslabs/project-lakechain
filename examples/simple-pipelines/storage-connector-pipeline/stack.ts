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
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as iam from 'aws-cdk-lib/aws-iam';

import { Construct } from 'constructs';
import { CacheStorage } from '@project-lakechain/core';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { PdfTextConverter } from '@project-lakechain/pdf-text-converter';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import { SqsStorageConnector } from '@project-lakechain/sqs-storage-connector';
import { FirehoseStorageConnector } from '@project-lakechain/firehose-storage-connector';

/**
 * An example showcasing how to build a pipeline which
 * forwards its results to multiple AWS services.
 * The pipeline looks as follows:
 *
 *
 *                                           ┌────────────────────────┐
 *                              ┌───────────►│  S3 Storage Connector  │
 *                              │            └────────────────────────┘
 *                              |
 * ┌──────────────┐    ┌─────────────────┐    ┌──────────────────────┐
 * │   S3 Input   ├───►│  PDF Converter  ├───►│  Firehose Connector  │
 * └──────────────┘    └─────────────────┘    └──────────────────────┘
 *                              |
 *                              │            ┌─────────────────────────┐
 *                              └───────────►│  SQS Storage Connector  │
 *                                           └─────────────────────────┘
 *
 */
export class MultiOutputPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline forwarding its results to multiple AWS services.',
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

    /////////////////////////////////////////////
    ///////     S3 Storage Connector      ///////
    /////////////////////////////////////////////

    // The S3 Storage Connector bucket.
    const s3StorageConnectorBucket = new s3.Bucket(this, 'S3StorageConnectorBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true
    });

    // Write the results to the destination bucket.
    new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('S3StorageConnector')
      .withCacheStorage(cache)
      .withDestinationBucket(s3StorageConnectorBucket)
      .withSource(pdfConverter)
      .build();

    // Display the S3 Storage Connector bucket information in the console.
    new cdk.CfnOutput(this, 'S3StorageConnectorBucketName', {
      description: 'The name of the S3 Storage Connector bucket.',
      value: s3StorageConnectorBucket.bucketName
    });

    //////////////////////////////////////////////
    ///////     SQS Storage Connector      ///////
    //////////////////////////////////////////////

    // The SQS Storage Connector queue.
    const sqsStorageConnectorQueue = new sqs.Queue(this, 'SQSStorageConnectorQueue', {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Write the results to the destination queue.
    new SqsStorageConnector.Builder()
      .withScope(this)
      .withIdentifier('SQSStorageConnector')
      .withCacheStorage(cache)
      .withDestinationQueue(sqsStorageConnectorQueue)
      .withSource(pdfConverter)
      .build();

    // Display the SQS Storage Connector queue information in the console.
    new cdk.CfnOutput(this, 'SQSStorageConnectorQueueUrl', {
      description: 'The URL of the SQS Storage Connector queue.',
      value: sqsStorageConnectorQueue.queueUrl
    });

    ///////////////////////////////////////////////
    ///////   Firehose Storage Connector    ///////
    ///////////////////////////////////////////////

    // Create the Firehose delivery stream.
    const { deliveryStream, firehoseStorageConnectorBucket } = this.createDeliveryStream();

    // Write the results to the destination delivery stream.
    new FirehoseStorageConnector.Builder()
      .withScope(this)
      .withIdentifier('FirehoseStorageConnector')
      .withCacheStorage(cache)
      .withDestinationStream(deliveryStream)
      .withSource(pdfConverter)
      .build();

    // Display the Firehose Storage Connector bucket information in the console.
    new cdk.CfnOutput(this, 'FirehoseStorageConnectorBucketName', {
      description: 'The name of the Firehose Storage Connector bucket.',
      value: firehoseStorageConnectorBucket.bucketName
    });

    // Display the source bucket information in the console.
    new cdk.CfnOutput(this, 'SourceBucketName', {
      description: 'The name of the source bucket.',
      value: source.bucketName
    });
  }

  /**
   * Creates the Firehose delivery stream.
   * @returns the created delivery stream.
   */
  private createDeliveryStream() {
    const firehoseStorageConnectorBucket = new s3.Bucket(this, 'FirehoseStorageConnectorBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true
    });

    // The IAM role to be used by the delivery stream.
    const deliveryRole = this.getFirehoseRole('FirehoseDeliveryRole', firehoseStorageConnectorBucket);

    // Create the delivery stream.
    const deliveryStream = new firehose.CfnDeliveryStream(this, 'Stream', {
      deliveryStreamType: 'DirectPut',
      s3DestinationConfiguration: {
        bucketArn: firehoseStorageConnectorBucket.bucketArn,
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 1
        },
        roleArn: deliveryRole.roleArn
      }
    });

    return ({ deliveryStream, firehoseStorageConnectorBucket });
  }

  /**
   * Creates the IAM role to be used by the Firehose
   * delivery stream.
   * @param id the identifier of the role.
   * @returns the created role.
   */
  private getFirehoseRole(id: string, bucket: s3.IBucket): iam.IRole {
    const role = new iam.Role(this, id, {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com')
    });

    role.addToPolicy(new iam.PolicyStatement({
      actions: [
        's3:AbortMultipartUpload',
        's3:GetBucketLocation',
        's3:GetObject',
        's3:ListBucket',
        's3:ListBucketMultipartUploads',
        's3:PutObject'
      ],
      resources: [
        bucket.bucketArn,
        bucket.arnForObjects('*')
      ]
    }));

    return (role);
  }
}

// Creating the CDK application.
const app = new cdk.App();

// Environment variables.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_DEFAULT_ACCOUNT;
const region  = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new MultiOutputPipeline(app, 'MultiOutputPipeline', {
  env: {
    account,
    region
  }
});

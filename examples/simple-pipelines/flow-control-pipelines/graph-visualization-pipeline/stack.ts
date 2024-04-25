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
import { PdfTextConverter } from '@project-lakechain/pdf-text-converter';
import { PandocTextConverter } from '@project-lakechain/pandoc-text-converter';
import { KeybertTextProcessor } from '@project-lakechain/keybert-text-processor';
import { S3StorageConnector } from '@project-lakechain/s3-storage-connector';
import { DagRenderer, MermaidRenderer } from '@project-lakechain/core/renderer';

/**
 * An example stack showcasing how to render a pipeline
 * into an image using the `DagRenderer`.
 */
export class DagRenderingPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline rendering a pipeline into an image.',
      ...env
    });

    // The VPC to use to store the KeyBERT model cache.
    const vpc = this.createVpc('Vpc');

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
      .withBucket(new s3.Bucket(this, 'Bucket', {
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        autoDeleteObjects: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY
      }))
      .build();

    // Convert PDF documents to text.
    const pdfConverter = new PdfTextConverter.Builder()
      .withScope(this)
      .withIdentifier('PdfConverter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // Convert Docx, Markdown, etc. to text.
    const pandocConverter = new PandocTextConverter.Builder()
      .withScope(this)
      .withIdentifier('PandocConverter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // Extract topics from the documents.
    const keybertProcessor = new KeybertTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('KeybertProcessor')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withSources([
        trigger,
        pdfConverter,
        pandocConverter
      ])
      .build();

    // Write the results to the destination bucket.
    const storageConnector = new S3StorageConnector.Builder()
      .withScope(this)
      .withIdentifier('StorageConnector')
      .withCacheStorage(cache)
      .withDestinationBucket(new s3.Bucket(this, 'Destination', {
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        autoDeleteObjects: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        enforceSSL: true
      }))
      .withSource(keybertProcessor)
      .build();

    // Creating the DAG renderer.
    const renderer = new DagRenderer({
      engine: new MermaidRenderer()
    });

    // Rendering the pipeline with the given middlewares.
    renderer.render([
      trigger,
      pdfConverter,
      pandocConverter,
      keybertProcessor,
      storageConnector
    ]);
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
new DagRenderingPipeline(app, 'DagRenderingPipeline', {
  env: {
    account,
    region
  }
});

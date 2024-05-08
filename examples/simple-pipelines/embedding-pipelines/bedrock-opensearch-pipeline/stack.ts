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
import { RecursiveCharacterTextSplitter } from '@project-lakechain/recursive-character-text-splitter';
import { OpenSearchVectorStorageConnector, OpenSearchVectorIndexDefinition } from '@project-lakechain/opensearch-vector-storage-connector';
import { TitanEmbeddingProcessor, TitanEmbeddingModel } from '@project-lakechain/bedrock-embedding-processors';
import { OpenSearchDomain } from '@project-lakechain/opensearch-domain';

/**
 * An example stack showcasing how to use Amazon Bedrock embeddings
 * and OpenSearch for storing embeddings.
 * The pipeline looks as follows:
 *
 *
 * ┌──────┐   ┌───────────────┐   ┌────────────────────┐   ┌──────────────┐
 * │  S3  ├──►│ Text Splitter ├──►│ Bedrock Embeddings │──►|  OpenSearch  │
 * └──────┘   └───────────────┘   └────────────────────┘   └──────────────┘
 *
 */
export class BedrockEmbeddingPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'An embedding storage pipeline using Amazon Bedrock and OpenSearch.',
      ...env
    });

    // The VPC in which OpenSearch will be deployed.
    const vpc = this.createVpc('Vpc');

    // The OpenSearch domain.
    const domain = new OpenSearchDomain(this, 'Domain', {
      vpc
    });

    ///////////////////////////////////////////
    ///////         S3 Storage          ///////
    ///////////////////////////////////////////

    // The source bucket where input documents are uploaded.
    const source = new s3.Bucket(this, 'Bucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true
    });

    // The cache storage.
    const cache = new CacheStorage(this, 'CacheStorage', {});

    ///////////////////////////////////////////
    ///////     Lakechain Pipeline      ///////
    ///////////////////////////////////////////

    // Monitor a bucket for uploaded objects.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(source)
      .build();

    // We use the `RecursiveCharacterTextSplitter` to split
    // input text into smaller chunks. This is required to ensure
    // that the generated embeddings are relevant.
    const textSplitter = new RecursiveCharacterTextSplitter.Builder()
      .withScope(this)
      .withIdentifier('RecursiveCharacterTextSplitter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withChunkSize(4096)
      .build();

    // Creates embeddings for text chunks using Amazon Titan.
    const embeddingProcessor = new TitanEmbeddingProcessor.Builder()
      .withScope(this)
      .withIdentifier('BedrockEmbeddingProcessor')
      .withCacheStorage(cache)
      .withSource(textSplitter)
      // You can optionally specify the embedding model to use.
      .withModel(TitanEmbeddingModel.AMAZON_TITAN_EMBED_TEXT_V2)
      // You can also use a region that supports Amazon Bedrock.
      .withRegion('us-east-1')
      .build();

    // The vector storage will create a new index and store the vectors
    // from previous middlewares into OpenSearch.
    new OpenSearchVectorStorageConnector.Builder()
      .withScope(this)
      .withIdentifier('OpenSearchVectorStorageConnector')
      .withCacheStorage(cache)
      .withEndpoint(domain.domain)
      .withSource(embeddingProcessor)
      .withVpc(vpc)
      // Specifies that the text associated with the embeddings
      // should be stored in OpenSearch.
      .withIncludeDocument(true)
      .withIndex(new OpenSearchVectorIndexDefinition.Builder()
        .withIndexName('vector-index')
        .withKnnMethod('hnsw')
        .withKnnEngine('nmslib')
        .withSpaceType('l2')
        // The dimensions of Amazon Titan embeddings.
        .withDimensions(1024)
        .withParameters({ 'ef_construction': 512, 'm': 16 })
        .build()
      )
      .build();

    // Display the source bucket information in the console.
    new cdk.CfnOutput(this, 'SourceBucketName', {
      description: 'The name of the source bucket.',
      value: source.bucketName
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
        name: 'public',
        subnetType: ec2.SubnetType.PUBLIC,
        cidrMask: 28
      }, {
        name: 'private',
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        cidrMask: 24
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
new BedrockEmbeddingPipeline(app, 'BedrockEmbeddingPipeline', {
  env: {
    account,
    region
  }
});

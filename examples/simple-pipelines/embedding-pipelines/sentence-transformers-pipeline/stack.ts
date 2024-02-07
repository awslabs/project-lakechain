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
import * as oss from '@project-lakechain/opensearch-collection';

import { Construct } from 'constructs';
import { CacheStorage } from '@project-lakechain/core';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { SentenceTransformers, SentenceTransformersModel } from '@project-lakechain/sentence-transformers';
import { RecursiveCharacterTextSplitter } from '@project-lakechain/recursive-character-text-splitter';
import { OpenSearchVectorStorageConnector, OpenSearchVectorIndexDefinition } from '@project-lakechain/opensearch-vector-storage-connector';

/**
 * An example stack showcasing how to use Project Lakechain
 * to create embeddings for text documents using Sentence Transformers.
 * The pipeline looks as follows:
 *
 *
 * ┌──────┐   ┌────────────────┐   ┌─────────────────────────┐   ┌──────────────┐
 * │  S3  ├──►│ Text Splitter  ├──►│  Sentence Transformers  │──►|  OpenSearch  │
 * └──────┘   └────────────────┘   └─────────────────────────┘   └──────────────┘
 *
 * @see https://huggingface.co/sentence-transformers
 */
export class SentenceTransformersPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline creating embeddings using sentence transformers.',
      ...env
    });

    // The VPC required by sentence transformers models.
    const vpc = this.createVpc('Vpc');

    // The OpenSearch collection.
    const collection = new oss.Collection(this, 'Collection', {
      name: 'vector-collection',
      description: 'A collection used to store embeddings.',
      vpc,
      type: 'VECTORSEARCH'
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
    const cache = new CacheStorage(this, 'Cache', {});

    ///////////////////////////////////////////
    ///////     Lakechain Pipeline      ///////
    ///////////////////////////////////////////

    // Monitor a bucket for uploaded objects.
    const ingestion = new S3EventTrigger.Builder()
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
      .withSource(ingestion)
      .withChunkSize(1024)
      .build();

    // Creates embeddings for text using Sentence Transformers
    // models.
    const sentenceTransformers = new SentenceTransformers.Builder()
      .withScope(this)
      .withIdentifier('SentenceTransformers')
      .withCacheStorage(cache)
      .withVpc(vpc)
      .withSource(textSplitter)
      // Optionally specify an embedding model to use.
      .withModel(SentenceTransformersModel.ALL_MPNET_BASE_V2)
      .build();

    // The vector storage will create a new index and store the vectors
    // from previous middlewares into OpenSearch.
    new OpenSearchVectorStorageConnector.Builder()
      .withScope(this)
      .withIdentifier('OpenSearchVectorStorageConnector')
      .withCacheStorage(cache)
      .withEndpoint(collection)
      .withSource(sentenceTransformers)
      .withVpc(vpc)
      // Specifies that the text associated with the embeddings
      // should be stored in OpenSearch.
      .withIncludeDocument(true)
      .withIndex(new OpenSearchVectorIndexDefinition.Builder()
        .withIndexName('vector-index')
        .withKnnMethod('hnsw')
        .withKnnEngine('nmslib')
        .withSpaceType('cosinesimil')
        // The dimensions of ALL_MPNET_BASE_V2 embeddings.
        .withDimensions(768)
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
      maxAzs: 1,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/20'),
      subnetConfiguration: [{
        // Used by NAT Gateways to provide Internet access
        // to the containers.
        name: 'public',
        subnetType: ec2.SubnetType.PUBLIC,
        cidrMask: 28
      }, {
        // Used by embeddings containers.
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
new SentenceTransformersPipeline(app, 'SentenceTransformersPipeline', {
  env: {
    account,
    region
  }
});

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
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';

import { CacheStorage } from '@project-lakechain/core';
import { LanceDbStorageConnector, S3StorageProvider } from '@project-lakechain/lancedb-storage-connector';
import { PandocTextConverter } from '@project-lakechain/pandoc-text-converter';
import { PdfTextConverter } from '@project-lakechain/pdf-text-converter';
import { RecursiveCharacterTextSplitter } from '@project-lakechain/recursive-character-text-splitter';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { Construct } from 'constructs';

import {
  InfrastructureDefinition,
  OllamaEmbeddingModel,
  OllamaEmbeddingProcessor
} from '@project-lakechain/ollama-embedding-processor';

/**
 * An example stack showcasing how to use Ollama embeddings
 * and LanceDB for storing embeddings.
 * The pipeline looks as follows:
 *
 *
 *                   ┌──────────────────────┐
 *    ┌─────────────►│  PDF Text Converter  ├──────────┐
 *    │              └──────────────────────┘          |
 *    |                                                ▼
 * ┌──────────────┐   ┌────────────────────┐   ┌───────────────┐   ┌──────────┐   ┌───────────┐
 * │   S3 Input   ├──►│  Pandoc Converter  ├──►│ Text Splitter ├──►│  Ollama  ├──►|  LanceDB  │
 * └──────────────┘   └────────────────────┘   └───────────────┘   └──────────┘   └───────────┘
 *
 */
export class OllamaLancedbPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'An embedding storage pipeline using Ollama and LanceDB.',
      ...env
    });

    // The VPC required by the EFS storage.
    const vpc = this.createVpc('Vpc');

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

    // The S3 bucket used to store the embeddings.
    const storage = new s3.Bucket(this, 'Storage', {
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

    // Convert PDF documents to text.
    const pdfConverter = new PdfTextConverter.Builder()
      .withScope(this)
      .withIdentifier('PdfConverter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // Convert text-oriented documents (Docx, Markdown, HTML, etc) to text.
    const pandocConverter = new PandocTextConverter.Builder()
      .withScope(this)
      .withIdentifier('PandocConverter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // We use the `RecursiveCharacterTextSplitter` to split
    // input text into smaller chunks. This is required to ensure
    // that the generated embeddings are relevant.
    const textSplitter = new RecursiveCharacterTextSplitter.Builder()
      .withScope(this)
      .withIdentifier('RecursiveCharacterTextSplitter')
      .withCacheStorage(cache)
      .withSources([
        pdfConverter,
        pandocConverter,
        trigger
      ])
      .withChunkSize(4096)
      .build();

    // Creates embeddings for text chunks using Ollama.
    const embeddingProcessor = new OllamaEmbeddingProcessor.Builder()
      .withScope(this)
      .withIdentifier('OllamaEmbeddingProcessor')
      .withCacheStorage(cache)
      .withSource(textSplitter)
      .withVpc(vpc)
      // The batch size controls how many chunks the Ollama embedding processor
      // will process in a single batch.
      .withBatchSize(10)
      .withModel(OllamaEmbeddingModel.NOMIC_EMBED_TEXT)
      .withInfrastructure(new InfrastructureDefinition.Builder()
        .withMaxMemory(15 * 1024)
        .withGpus(1)
        .withInstanceType(ec2.InstanceType.of(
          ec2.InstanceClass.G4DN,
          ec2.InstanceSize.XLARGE2
        ))
        .build())
      .build();

    // Store the embeddings in LanceDB.
    new LanceDbStorageConnector.Builder()
      .withScope(this)
      .withIdentifier('LanceDbStorageConnector')
      .withCacheStorage(cache)
      .withSource(embeddingProcessor)
      .withVectorSize(768)
      .withStorageProvider(new S3StorageProvider.Builder()
        .withScope(this)
        .withIdentifier('S3Storage')
        .withBucket(storage)
        .build())
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
        // Used by the embedding containers.
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
new OllamaLancedbPipeline(app, 'OllamaLancedbPipeline', {
  env: {
    account,
    region
  }
});

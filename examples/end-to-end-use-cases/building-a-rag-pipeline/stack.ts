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
import { TranscribeAudioProcessor } from '@project-lakechain/transcribe-audio-processor';
import { RecursiveCharacterTextSplitter } from '@project-lakechain/recursive-character-text-splitter';
import { CohereEmbeddingProcessor, CohereEmbeddingModel } from '@project-lakechain/bedrock-embedding-processors';
import { OpenSearchDomain } from '@project-lakechain/opensearch-domain';
import { OpenSearchVectorStorageConnector, OpenSearchVectorIndexDefinition } from '@project-lakechain/opensearch-vector-storage-connector';
import { AnthropicTextProcessor, AnthropicTextModel } from '@project-lakechain/bedrock-text-processors';

/**
 * An example showcasing how to build an end-to-end
 * Retrieval Augmented Generation (RAG) pipeline using
 * Amazon Bedrock and Amazon OpenSearch.
 */
export class RagPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'An end-to-end RAG pipeline using Amazon Bedrock and Amazon OpenSearch.',
      ...env
    });

    // The VPC in which OpenSearch will be deployed.
    const vpc = this.createVpc('Vpc');

    // The OpenSearch domain.
    const openSearch = new OpenSearchDomain(this, 'Domain', {
      vpc
    });

    // The source bucket.
    const bucket = new s3.Bucket(this, 'Bucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true
    });

    // The cache storage.
    const cache = new CacheStorage(this, 'Cache', {});

    ///////////////////////////////////////////
    //////     Pipeline Data Sources     //////
    ///////////////////////////////////////////

    // Create the S3 trigger monitoring the bucket
    // for uploaded objects.
    const trigger = new S3EventTrigger.Builder()
      .withScope(this)
      .withIdentifier('Trigger')
      .withCacheStorage(cache)
      .withBucket(bucket)
      .build();

    ///////////////////////////////////////////
    ///     Pipeline Document Converters    ///
    ///////////////////////////////////////////

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

    // Convert audio recordings to text.
    const transcribe = new TranscribeAudioProcessor.Builder()
      .withScope(this)
      .withIdentifier('TranscribeTextProcessor')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withOutputFormats('vtt')
      .build();

    // Convert the VTT transcription file to a summarized
    // version of the conversation.
    const textProcessor = new AnthropicTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('TextProcessor')
      .withCacheStorage(cache)
      .withSource(transcribe)
      .withModel(AnthropicTextModel.ANTHROPIC_CLAUDE_V3_SONNET)
      .withRegion('us-east-1')
      .withPrompt(`
        Give a very comprehensive description of the content of this transcription file with these constraints:
        - Summarize all the data points of the transcript.
        - Focus only on the content of the transcript, not the formatting.
        - Don't say "This is a transcription of an audio file" or anything similar, just output the summary.
        - The output should be spread in multiple paragraphs.
      `)
      .build();

    ///////////////////////////////////////////
    //////////     Text Splitter     //////////
    ///////////////////////////////////////////

    // Split the text into chunks.
    const textSplitter = new RecursiveCharacterTextSplitter.Builder()
      .withScope(this)
      .withIdentifier('RecursiveCharacterTextSplitter')
      .withCacheStorage(cache)
      .withChunkSize(2000)
      .withSources([
        trigger,
        pdfConverter,
        pandocConverter,
        textProcessor
      ])
      .build();

    /////////////////////////////////////
    ////   Embeddings with Bedrock   ////
    /////////////////////////////////////

    // Creates embeddings for the text using a Cohere embedding
    // model hosted on Amazon Bedrock.
    const embeddingProcessor = new CohereEmbeddingProcessor.Builder()
      .withScope(this)
      .withIdentifier('CohereEmbeddingProcessor')
      .withCacheStorage(cache)
      .withSource(textSplitter)
      // You can specify the embedding model to use.
      .withModel(CohereEmbeddingModel.COHERE_EMBED_MULTILINGUAL_V3)
      // You can also specify a region that supports Amazon Bedrock.
      .withRegion('us-east-1')
      .build();

    ///////////////////////////////////////////
    ////     Pipeline Storage Providers    ////
    ///////////////////////////////////////////

    // Vector storage for text.
    new OpenSearchVectorStorageConnector.Builder()
      .withScope(this)
      .withIdentifier('TextVectorStorage')
      .withCacheStorage(cache)
      .withEndpoint(openSearch.domain)
      .withSource(embeddingProcessor)
      .withVpc(vpc)
      .withIncludeDocument(true)
      .withIndex(new OpenSearchVectorIndexDefinition.Builder()
        .withIndexName('text-vectors')
        .withKnnMethod('hnsw')
        .withKnnEngine('nmslib')
        .withSpaceType('l2')
        .withDimensions(1024)
        .withParameters({ 'ef_construction': 512, 'm': 16 })
        .build()
      )
      .build();

    // Display the source bucket information in the console.
    new cdk.CfnOutput(this, 'SourceBucket', {
      description: 'The name of the source bucket.',
      value: bucket.bucketName
    });

    // Display the OpenSearch endpoint.
    new cdk.CfnOutput(this, 'OpenSearchEndpoint', {
      description: 'The endpoint of the OpenSearch domain.',
      value: `https://${openSearch.domain.domainEndpoint}`
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
      }, {
        name: 'isolated',
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
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
new RagPipeline(app, 'RagPipeline', {
  env: {
    account,
    region
  }
});

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
import { AudioMetadataExtractor } from '@project-lakechain/audio-metadata-extractor';
import { ImageMetadataExtractor } from '@project-lakechain/image-metadata-extractor';
import { NlpTextProcessor, dsl as l } from '@project-lakechain/nlp-text-processor';
import { VideoMetadataExtractor } from '@project-lakechain/video-metadata-extractor';
import { OpenSearchStorageConnector } from '@project-lakechain/opensearch-storage-connector';
import { PdfTextConverter } from '@project-lakechain/pdf-text-converter';
import { PandocTextConverter } from '@project-lakechain/pandoc-text-converter';
import { RekognitionImageProcessor, dsl as r } from '@project-lakechain/rekognition-image-processor';
import { OpenSearchIndex } from '@project-lakechain/opensearch-index';
import { OpenSearchSavedObject } from '@project-lakechain/opensearch-saved-object';
import { SharpImageTransform, sharp } from '@project-lakechain/sharp-image-transform';
import { OpenSearchDomain } from '@project-lakechain/opensearch-domain';

/**
 * The index to create in OpenSearch.
 */
const OPENSEARCH_INDEX_NAME = 'documents';

/**
 * An example showcasing how to build an end-to-end document
 * indexing pipeline using Lakechain and OpenSearch.
 */
export class DocumentIndexPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline extracting metadata from documents and indexing them in OpenSearch.',
      ...env
    });

    // The VPC in which OpenSearch will be deployed.
    const vpc = this.createVpc('Vpc');

    // The OpenSearch domain.
    const openSearch = this.createOpenSearchDomain(vpc);

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

    ///////////////////////////////////////////
    ///     Pipeline Metadata Extractors    ///
    ///////////////////////////////////////////

    // Extracts metadata from audio files.
    const audioMetadata = new AudioMetadataExtractor.Builder()
      .withScope(this)
      .withIdentifier('AudioMetadata')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // Extracts metadata from images.
    const imageMetadata = new ImageMetadataExtractor.Builder()
      .withScope(this)
      .withIdentifier('ImageMetadata')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // Transform all images to PNG format,
    // resize them to keep a smaller image to pass
    // to the Rekognition image processor.
    const sharpTransform = new SharpImageTransform.Builder()
      .withScope(this)
      .withIdentifier('SharpImageTransform')
      .withCacheStorage(cache)
      .withSource(imageMetadata)
      .withSharpTransforms(
        sharp()
          .png()
          .resize(1024)
      )
      .build();

    // The Rekognition image processor will identify labels in processed images
    // in order to extract relevant keywords about the image that will be indexed.
    const rekognition = new RekognitionImageProcessor.Builder()
      .withScope(this)
      .withIdentifier('RekognitionImageProcessor')
      .withCacheStorage(cache)
      .withSource(sharpTransform)
      .withIntent(
        r.detect().labels(r.confidence(90))
      )
      .build();

    // Extracts metadata from text documents.
    const nlpProcessor = new NlpTextProcessor.Builder()
      .withScope(this)
      .withIdentifier('NlpProcessor')
      .withCacheStorage(cache)
      .withSources([
        trigger,
        pdfConverter,
        pandocConverter
      ])
      .withIntent(
        l.nlp()
          .language()
          .readingTime()
          .stats()
      )
      .build();

    // Extracts metadata from video files.
    const videoMetadata = new VideoMetadataExtractor.Builder()
      .withScope(this)
      .withIdentifier('VideoMetadata')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    ///////////////////////////////////////////
    ////     Pipeline Storage Providers    ////
    ///////////////////////////////////////////

    // Indexes the extracted metadata in OpenSearch.
    new OpenSearchStorageConnector.Builder()
      .withScope(this)
      .withIdentifier('OpenSearchStorage')
      .withCacheStorage(cache)
      .withSources([
        audioMetadata,
        nlpProcessor,
        videoMetadata,
        rekognition
      ])
      .withDomain(openSearch.domain)
      .withVpc(vpc)
      .withIndexName(OPENSEARCH_INDEX_NAME)
      .build();

    // Display the source bucket information in the console.
    new cdk.CfnOutput(this, 'BucketName', {
      description: 'The name of the source bucket.',
      value: bucket.bucketName
    });

    // Display the source bucket information in the console.
    new cdk.CfnOutput(this, 'DashboardUrl', {
      description: 'The OpenSearch dashboard URL.',
      value: `https://${openSearch.domain.domainEndpoint}/_dashboards`
    });

    // Display the user pool address.
    new cdk.CfnOutput(this, 'UserPoolUrl', {
      description: 'The Cognito user pool user management address.',
      value: `https://${cdk.Aws.REGION}.console.aws.amazon.com/cognito/v2/idp/user-pools/${openSearch.userPool.userPoolId}/users`
    });
  }

  /**
   * Creates a new OpenSearch domain for this example,
   * and automatically creates the index and dashboard
   * for visualizing the documents.
   * @param vpc the VPC in which the OpenSearch domain
   * should be deployed.
   */
  private createOpenSearchDomain(vpc: ec2.IVpc) {
    const openSearch = new OpenSearchDomain(this, 'Domain', {
      vpc
    });

    // Create the OpenSearch index.
    new OpenSearchIndex(this, 'Index', {
      indexName: OPENSEARCH_INDEX_NAME,
      endpoint: openSearch.domain,
      vpc,
      body: {
        mappings: {
          properties: {
            time: {
              type: 'date'
            }
          }
        }
      }
    });

    // Upload the dashboard for visualizing documents
    // on OpenSearch.
    new OpenSearchSavedObject(this, 'Dashboard', {
      domain: openSearch.domain,
      vpc,
      savedObject: {
        data: fs.readFileSync(
          path.resolve(__dirname, 'assets', 'dashboard.ndjson')
        ).toString('utf-8'),
        name: 'dashboard.ndjson'
      }
    });

    return (openSearch);
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
new DocumentIndexPipeline(app, 'DocumentIndexPipeline', {
  env: {
    account,
    region
  }
});

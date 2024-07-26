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
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';

import { Construct } from 'constructs';
import { CacheStorage } from '@project-lakechain/core';
import { S3EventTrigger } from '@project-lakechain/s3-event-trigger';
import { PdfTextConverter } from '@project-lakechain/pdf-text-converter';
import { PandocTextConverter } from '@project-lakechain/pandoc-text-converter';
import { SemanticOntologyExtractor } from '@project-lakechain/semantic-ontology-extractor';
import { SharpImageTransform, sharp } from '@project-lakechain/sharp-image-transform';
import { Neo4jStorageConnector } from '@project-lakechain/neo4j-storage-connector';

/**
 * An example showcasing how to use Amazon Bedrock
 * to extract semantic ontology from documents.
 *
 *
 *                   ┌──────────────────────┐
 *    ┌─────────────►│  PDF Text Converter  ├───────┐
 *    │              └──────────────────────┘       |
 *    |                                             ▼
 * ┌──────────────┐   ┌────────────────────┐   ┌────────────────────┐   ┌─────────┐
 * │   S3 Input   ├──►│  Pandoc Converter  ├──►│ Ontology Extractor ├──►│  Neo4j  │
 * └──────────────┘   └────────────────────┘   └────────────────────┘   └─────────┘
 *
 * @note You will need to pass the URI of the Neo4j database
 * as an environment variable named `NEO4J_URI`, and a secret
 * stored in secrets manager holding the credentials required to
 * access the database named `NEO4J_CREDENTIALS_SECRET_NAME`.
 * 
 * For example:
 * NEO4J_URI='neo4j+s://<id>.databases.neo4j.io' \
 * NEO4J_CREDENTIALS_SECRET_NAME='neo4j/credentials' \
 * npm run deploy
 * 
 */
export class KnowledgeGraphPipeline extends cdk.Stack {

  /**
   * Stack constructor.
   */
  constructor(scope: Construct, id: string, env: cdk.StackProps) {
    super(scope, id, {
      description: 'A pipeline extracting semantic ontology from documents.',
      ...env
    });

    if (!process.env.NEO4J_URI) {
      throw new Error(`
        Missing the NEO4J_URI environment variable.
      `);
    }

    if (!process.env.NEO4J_CREDENTIALS_SECRET_NAME) {
      throw new Error(`
        Missing the NEO4J_CREDENTIALS_SECRET_NAME environment variable.
      `);
    }

    // The Neo4j credentials secret.
    const neo4jCredentials = secrets.Secret.fromSecretNameV2(
      this,
      'Neo4jCredentials',
      process.env.NEO4J_CREDENTIALS_SECRET_NAME
    );

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

    // Convert text-oriented documents (Docx, Markdown, HTML, etc) to text.
    const pandocConverter = new PandocTextConverter.Builder()
      .withScope(this)
      .withIdentifier('PandocConverter')
      .withCacheStorage(cache)
      .withSource(trigger)
      .build();

    // Resize images before they are handled by the `SemanticOntologyExtractor`.
    const imageTransform = new SharpImageTransform.Builder()
      .withScope(this)
      .withIdentifier('SharpTransform')
      .withCacheStorage(cache)
      .withSource(trigger)
      .withSharpTransforms(
        sharp()
          .resize(500)
          .png()
      )
      .build();

    // We are using the `SemanticOntologyExtractor` to extract
    // semantic information from the documents.
    const extractor = new SemanticOntologyExtractor.Builder()
      .withScope(this)
      .withIdentifier('SemanticOntologyExtractor')
      .withCacheStorage(cache)
      .withRegion('us-east-1')
      .withSources([
        pdfConverter,
        pandocConverter,
        imageTransform,
        trigger
      ])
      .build();

    // Write the results to the Neo4j database.
    new Neo4jStorageConnector.Builder()
      .withScope(this)
      .withIdentifier('Neo4jStorageConnector')
      .withCacheStorage(cache)
      .withSource(extractor)
      .withUri(process.env.NEO4J_URI as string)
      .withCredentials(neo4jCredentials)
      .build();

    // Display the source bucket information in the console.
    new cdk.CfnOutput(this, 'SourceBucketName', {
      description: 'The name of the source bucket.',
      value: source.bucketName
    });
  }
}

// Creating the CDK application.
const app = new cdk.App();

// Environment variables.
const account = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_DEFAULT_ACCOUNT;
const region  = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_DEFAULT_REGION;

// Deploy the stack.
new KnowledgeGraphPipeline(app, 'KnowledgeGraphPipeline', {
  env: {
    account,
    region
  }
});

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

import path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { Neo4jStorageConnectorProps, Neo4jStorageConnectorPropsSchema } from './definitions/opts';
import {
  Middleware,
  MiddlewareBuilder,
  LAMBDA_INSIGHTS_VERSION,
  NAMESPACE
} from '@project-lakechain/core/middleware';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'neo4j-storage-connector',
  description: 'A data store connector for Neo4j.',
  version: '0.10.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.seconds(15);

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME  = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 128;

/**
 * The Neo4j storage connector builder.
 */
class Neo4jStorageConnectorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<Neo4jStorageConnectorProps> = {};

  /**
   * Sets the URI for the Neo4j API.
   * @param uri the URI for the Neo4j API.
   */
  public withUri(uri: string): Neo4jStorageConnectorBuilder {
    this.providerProps.uri = uri;
    return (this);
  }

  /**
   * Sets the credentials to use for the Neo4j API.
   * @param credentials the credentials to use for the Neo4j API.
   */
  public withCredentials(credentials: secrets.ISecret): Neo4jStorageConnectorBuilder {
    this.providerProps.credentials = credentials;
    return (this);
  }

  /**
   * @returns a new instance of the `Neo4jStorageConnector`
   * service constructed with the given parameters.
   */
  public build(): Neo4jStorageConnector {
    return (new Neo4jStorageConnector(
      this.scope,
      this.identifier, {
        ...this.providerProps as Neo4jStorageConnectorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service allowing to integrate the document graph
 * with a Neo4j datastore.
 */
export class Neo4jStorageConnector extends Middleware {

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The builder for the `Neo4jStorageConnector` service.
   */
  public static readonly Builder = Neo4jStorageConnectorBuilder;

  /**
   * Neo4j data store constructor.
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @param props the construct properties.
   */
  constructor(scope: Construct, id: string, props: Neo4jStorageConnectorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    props = this.parse(Neo4jStorageConnectorPropsSchema, props);

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.processor = new node.NodejsFunction(this, 'Processor', {
      description: 'A function writing vector embeddings in a Neo4j database.',
      entry: path.resolve(__dirname, 'lambdas', 'processor', 'index.js'),
      vpc: props.vpc,
      memorySize: props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
      timeout: PROCESSING_TIMEOUT,
      runtime: EXECUTION_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: props.kmsKey,
      logGroup: this.logGroup,
      insightsVersion: props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      environment: {
        POWERTOOLS_SERVICE_NAME: description.name,
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        LAKECHAIN_CACHE_STORAGE: props.cacheStorage.id(),
        NEO4J_URI: props.uri,
        NEO4J_CREDENTIALS_SECRET_NAME: props.credentials.secretName
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-s3',
          '@aws-sdk/client-secrets-manager'
        ]
      }
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.processor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.processor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: props.batchSize ?? 2,
      maxBatchingWindow: props.batchingWindow ?? cdk.Duration.seconds(10),
      maxConcurrency: 5,
      reportBatchItemFailures: true
    }));

    // Grant the lambda function permissions to
    // read from the API credentials secret.
    props.credentials.grantRead(this.processor);

    super.bind();
  }

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  grantReadProcessedDocuments(_: iam.IGrantable): iam.Grant {
    return ({} as iam.Grant);
  }

  /**
   * @returns an array of mime-types supported as input
   * type by this middleware.
   */
  supportedInputTypes(): string[] {
    return ([
      '*/*'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by this middleware.
   */
  supportedOutputTypes(): string[] {
    return ([]);
  }

  /**
   * @returns the supported compute types by a given
   * middleware.
   */
  supportedComputeTypes(): ComputeType[] {
    return ([
      ComputeType.CPU
    ]);
  }

  /**
   * @returns the middleware conditional statement defining
   * in which conditions this middleware should be executed.
   * In this case, we want the middleware to only be invoked
   * when the document mime-type is supported, and the event
   * type is `document-created`.
   */
  conditional() {
    return (super
      .conditional()
      .and(when('type').equals('document-created'))
    );
  }
}

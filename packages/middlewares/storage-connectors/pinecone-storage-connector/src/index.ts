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
import { PineconeStorageConnectorProps, PineconeStorageConnectorPropsSchema } from './definitions/opts';
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
  name: 'pinecone-storage-connector',
  description: 'A data store connector for Pinecone.',
  version: '0.1.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.minutes(1);

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME  = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 256;

/**
 * The Pinecone storage connector builder.
 */
class PineconeStorageConnectorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<PineconeStorageConnectorProps> = {};

  /**
   * Sets the API key to use.
   * @param apiKey the API key to use.
   */
  public withApiKey(apiKey: secrets.ISecret) {
    this.providerProps.apiKey = apiKey;
    return (this);
  }

  /**
   * Sets the index name to use.
   * @param indexName the index name to use.
   * @returns the builder instance.
   */
  public withIndexName(indexName: string) {
    this.providerProps.indexName = indexName;
    return (this);
  }

  /**
   * Sets the namespace to use.
   * @param namespace the namespace to use.
   * @returns the builder instance.
   */
  public withNamespace(namespace: string) {
    this.providerProps.namespace = namespace;
    return (this);
  }

  /**
   * Sets the controller host URL to use.
   * @param controllerHostUrl the controller host URL to use.
   * @returns the builder instance.
   * @default https://api.pinecone.io
   */
  public withControllerHostUrl(controllerHostUrl: string) {
    this.providerProps.controllerHostUrl = controllerHostUrl;
    return (this);
  }

  /**
   * Sets whether to include the text from the
   * chunks in the Pinecone index metadata.
   * @param includeText whether to include the text
   * associated with the embeddings in Pinecone.
   * @returns the builder instance.
   */
  public withIncludeText(includeText: boolean) {
    this.providerProps.includeText = includeText;
    return (this);
  }

  /**
   * @returns a new instance of the `PineconeStorageConnector`
   * service constructed with the given parameters.
   */
  public build(): PineconeStorageConnector {
    return (new PineconeStorageConnector(
      this.scope,
      this.identifier, {
        ...this.providerProps as PineconeStorageConnectorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service allowing to integrate vector embeddings
 * with a Pinecone datastore.
 */
export class PineconeStorageConnector extends Middleware {

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The builder for the `PineconeStorageConnector` service.
   */
  static Builder = PineconeStorageConnectorBuilder;

  /**
   * Pinecone data store constructor.
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @param props the construct properties.
   */
  constructor(scope: Construct, id: string, props: PineconeStorageConnectorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    props = this.parse(PineconeStorageConnectorPropsSchema, props);

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.processor = new node.NodejsFunction(this, 'Processor', {
      description: 'A function writing vector embeddings in a Pinecone index.',
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
        API_KEY_SECRET_NAME: props.apiKey.secretName,
        PINECONE_INDEX_NAME: props.indexName,
        PINECONE_NAMESPACE: props.namespace,
        PINECONE_CONTROLLER_HOST_URL: props.controllerHostUrl,
        INCLUDE_TEXT: props.includeText ? 'true' : 'false'
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
    // read from the API key secret.
    props.apiKey.grantRead(this.processor);

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
   * when the document mime-type is supported, the event
   * type is `document-created`, and embeddings are available
   * in the document metadata.
   */
  conditional() {
    return (super
      .conditional()
      .and(when('type').equals('document-created'))
      .and(when('data.metadata.properties.attrs.embeddings.vectors').exists())
    );
  }
}

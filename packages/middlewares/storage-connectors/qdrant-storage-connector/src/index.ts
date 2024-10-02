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
import { QdrantStorageConnectorProps, QdrantStorageConnectorPropsSchema } from './definitions/opts';
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
  name: 'qdrant-storage-connector',
  description: 'A data store connector for Qdrant.',
  version: '0.10.0',
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
 * The Qdrant storage connector builder.
 */
class QdrantStorageConnectorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<QdrantStorageConnectorProps> = {};

  /**
   * Sets the API key to use.
   * @param apiKey the API key to use.
   */
  public withApiKey(apiKey: secrets.ISecret) {
    this.providerProps.apiKey = apiKey;
    return (this);
  }

  /**
   * Sets the collection name to use.
   * @param collectionName the collection name to use.
   * @returns the builder instance.
   */
  public withCollectionName(collectionName: string) {
    this.providerProps.collectionName = collectionName;
    return (this);
  }

  /**
   * Sets the Qdrant URL to use.
   * @param url the Qdrant URL to use.
   * @returns the builder instance.
   * @example withUrl('https://xyz-example.eu-central.aws.cloud.qdrant.io:6333')
   */
  public withUrl(url: string) {
    this.providerProps.url = url;
    return (this);
  }

  /**
   * Sets whether to store the text associated
   * with the embeddings in Qdrant as payload.
   * @param includeText whether to store the text.
   * @returns the builder instance.
   */
  public withStoreText(storeText: boolean) {
    this.providerProps.storeText = storeText;
    return (this); 
  }

  /**
   * Sets the payload key to use for the text in the Qdrant payload.
   * @param textKey The key to use for the text in the Qdrant payload.
   * @returns the builder instance.
   */
  public withTextKey(textKey: string) {
    this.providerProps.textKey = textKey;
    return (this);
  }

  /**
   * Sets the name of the vector to use.
   * @param vectorName the name of the vector to use.
   * @default '' Uses the default unnamed vector.
   * @returns the builder instance.
   */
  public withVectorName(vectorName: string) {
    this.providerProps.vectorName = vectorName;
    return (this);
  }

  /**
   * @returns a new instance of the `QdrantStorageConnector`
   * service constructed with the given parameters.
   */
  public build(): QdrantStorageConnector {
    return (new QdrantStorageConnector(
      this.scope,
      this.identifier, {
        ...this.providerProps as QdrantStorageConnectorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service allowing to ingest vector embeddings
 * to a Qdrant collection.
 */
export class QdrantStorageConnector extends Middleware {

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The builder for the `QdrantStorageConnector` service.
   */
  public static readonly Builder = QdrantStorageConnectorBuilder;

  /**
   * Qdrantdata store constructor.
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @param props the construct properties.
   */
  constructor(scope: Construct, id: string, props: QdrantStorageConnectorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    props = this.parse(QdrantStorageConnectorPropsSchema, props);

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.processor = new node.NodejsFunction(this, 'Processor', {
      description: 'A function writing vector embeddings in a Qdrant collection.',
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
        QDRANT_API_KEY_SECRET_NAME: props.apiKey.secretName,
        QDRANT_COLLECTION_NAME: props.collectionName,
        QDRANT_URL: props.url,
        QDRANT_STORE_TEXT: props.storeText ? 'true' : 'false',
        QDRANT_TEXT_KEY: props.textKey,
        QDRANT_VECTOR_NAME: props.vectorName
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

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
import * as iam from 'aws-cdk-lib/aws-iam';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as oss from '@project-lakechain/opensearch-collection';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { OpenSearchIndex } from '@project-lakechain/opensearch-index';
import { OpenSearchVectorIndexDefinition } from './definitions/index';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { ServiceIdentifier } from './definitions/service-identifier';

import {
  OpenSearchVectorStorageConnectorProps,
  OpenSearchVectorStorageConnectorPropsSchema,
} from './definitions/opts';
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
  name: 'opensearch-vector-storage-connector',
  description: 'Stores document embeddings in an OpenSearch vector index.',
  version: '0.7.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.seconds(30);

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME  = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 256;

/**
 * Builder for the `OpenSearchVectorStorageConnector` service.
 */
class OpenSearchVectorStorageConnectorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<OpenSearchVectorStorageConnectorProps> = {};

  /**
   * Specifies the OpenSearch endpoint to use.
   */
  public withEndpoint(endpoint: opensearch.IDomain | oss.ICollection | opensearchserverless.CfnCollection) {
    if (endpoint instanceof opensearchserverless.CfnCollection) {
      endpoint = oss.Collection.fromCollectionAttributes(this.scope, 'Collection', {
        collectionName: endpoint.name,
        collectionArn: endpoint.attrArn,
        collectionId: endpoint.attrId,
        collectionEndpoint: endpoint.attrCollectionEndpoint,
        dashboardEndpoint: endpoint.attrDashboardEndpoint
      });
    }
    this.providerProps.endpoint = endpoint;
    return (this);
  }

  /**
   * Specifies the definition of the index to use.
   * @param index the index definition.
   * @returns the current builder instance.
   * @see https://opensearch.org/docs/latest/search-plugins/knn/knn-index#method-definitions
   */
  public withIndex(index: OpenSearchVectorIndexDefinition) {
    this.providerProps.index = index;
    return (this);
  }

  /**
   * Specifies whether to include the document associated
   * with the embeddings in the OpenSearch index.
   * @param includeDocument whether to include the document.
   * @returns the current builder instance.
   * @default true
   */
  public withIncludeDocument(includeDocument: boolean) {
    this.providerProps.includeDocument = includeDocument;
    return (this);
  }

  /**
   * @returns a new instance of the `OpenSearchVectorStorageConnector`
   * service constructed with the given parameters.
   */
  public build(): OpenSearchVectorStorageConnector {
    return (new OpenSearchVectorStorageConnector(
      this.scope,
      this.identifier, {
        ...this.providerProps as OpenSearchVectorStorageConnectorProps,
        ...this.props
      }
    ));
  }
}

/**
 * Forwards document events and their associated vector embeddings
 * to an OpenSearch vector index.
 */
export class OpenSearchVectorStorageConnector extends Middleware {

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The builder for the `OpenSearchVectorStorageConnector` service.
   */
  static Builder = OpenSearchVectorStorageConnectorBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: OpenSearchVectorStorageConnectorProps) {
    super(scope, id, description, props);

    // Validate the properties.
    this.props = this.parse(OpenSearchVectorStorageConnectorPropsSchema, props);

    ///////////////////////////////////////////////
    ///////    OpenSearch Vector Index      ///////
    ///////////////////////////////////////////////

    // Create the vector index.
    new OpenSearchIndex(this, 'Index', {
      indexName: this.props.index.indexName(),
      endpoint: this.props.endpoint,
      vpc: this.props.vpc,
      body: {
        settings: {
          index: {
            knn: true,
            'knn.algo_param.ef_search': this.props.index.efSearch()
          }
        },
        mappings: {
          properties: {
            embeddings: {
              type: 'knn_vector',
              dimension: this.props.index.dimensions(),
              method: {
                name: this.props.index.knnMethod(),
                space_type: this.props.index.spaceType(),
                engine: this.props.index.knnEngine(),
                parameters: this.props.index.parameters()
              }
            }
          }
        }
      }
    });

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.processor = new node.NodejsFunction(this, 'Compute', {
      description: 'A function writing vector embeddings in an OpenSearch index.',
      entry: path.resolve(__dirname, 'lambdas', 'processor', 'index.js'),
      vpc: this.props.vpc,
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
        LAKECHAIN_CACHE_STORAGE: this.props.cacheStorage.id(),
        INDEX_NAME: this.props.index.indexName(),
        OPENSEARCH_ENDPOINT: this.getEndpoint(this.props.endpoint),
        INCLUDE_DOCUMENT: props.includeDocument ? 'true' : 'false',
        SERVICE_IDENTIFIER: this.getServiceIdentifier(this.props.endpoint)
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-s3',
          '@aws-sdk/credential-provider-node'
        ]
      }
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.processor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.processor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: props.batchSize ?? 10,
      maxBatchingWindow: props.batchingWindow ?? cdk.Duration.seconds(20),
      maxConcurrency: 10,
      reportBatchItemFailures: true
    }));

    if (this.props.endpoint instanceof opensearch.Domain) {
      // Grant the lambda function permissions to write
      // to the OpenSearch index.
      this.props.endpoint.grantWrite(this.processor);
    } else if (this.props.endpoint instanceof oss.Collection) {
      // If the endpoint is a collection, we need to create an
      // access policy on the collection to allow the lambda function
      // to manage the index.
      this.props.endpoint.addAccessPolicy(
        this.node.id,
        [this.processor.role!.roleArn],
        [
          'aoss:ReadDocument',
          'aoss:WriteDocument',
          'aoss:CreateIndex',
          'aoss:DescribeIndex',
          'aoss:DeleteIndex',
          'aoss:UpdateIndex'
        ]
      );

      // We also need to grant the lambda function permissions
      // to write to the OpenSearch index.
      this.processor.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['aoss:APIAccessAll'],
        resources: [this.props.endpoint.collectionArn]
      }));
    }

    super.bind();
  }

  /**
   * Get the URL of the OpenSearch endpoint.
   * @param endpoint the OpenSearch endpoint.
   * @returns the endpoint URL.
   */
  private getEndpoint(endpoint: opensearch.IDomain | oss.ICollection): string {
    if (endpoint instanceof opensearch.Domain) {
      return (`https://${endpoint.domainEndpoint}`);
    } else if (endpoint instanceof oss.Collection) {
      return (endpoint.collectionEndpoint);
    } else {
      throw new Error('Invalid endpoint.');
    }
  }

  /**
   * Get the service identifier of the OpenSearch endpoint.
   * @param endpoint the OpenSearch endpoint.
   * @returns the service identifier.
   */
  private getServiceIdentifier(endpoint: opensearch.IDomain | oss.ICollection): ServiceIdentifier {
    if (endpoint instanceof opensearch.Domain) {
      return ('es');
    } else if (endpoint instanceof oss.Collection) {
      return ('aoss');
    } else {
      throw new Error('Invalid endpoint.');
    }
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
   * type by the data producer.
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

export { OpenSearchVectorIndexDefinition } from './definitions/index';

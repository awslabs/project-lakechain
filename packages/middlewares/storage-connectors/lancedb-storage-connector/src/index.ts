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
import * as efs from 'aws-cdk-lib/aws-efs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { LanceDbStorageConnectorProps, LanceDbStorageConnectorPropsSchema } from './definitions/opts';
import { LanceDbLayer } from '@project-lakechain/layers/lancedb';
import { EfsStorageProvider } from './definitions/storage';
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
  name: 'lancedb-storage-connector',
  description: 'A data store connector for LanceDB.',
  version: '0.7.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.seconds(60);

/**
 * The execution runtime for used compute.
 */
const EXECUTION_RUNTIME  = lambda.Runtime.NODEJS_18_X;

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 256;

/**
 * The LanceDB storage connector builder.
 */
class LanceDbStorageConnectorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<LanceDbStorageConnectorProps> = {};

  /**
   * Sets the storage provider to use.
   * @param storageProvider the storage provider to use.
   * @returns the builder instance.
   */
  public withStorageProvider(storageProvider: LanceDbStorageConnectorProps['storageProvider']) {
    this.providerProps.storageProvider = storageProvider;
    return (this);
  }

  /**
   * Sets the name of the table in LanceDB.
   * @param tableName the name of the table in LanceDB.
   * @returns the builder instance.
   */
  public withTableName(tableName: string) {
    this.providerProps.tableName = tableName;
    return (this);
  }

  /**
   * Sets the size of the vector embeddings.
   * @param vectorSize the size of the vector embeddings.
   * @returns the builder instance.
   */
  public withVectorSize(vectorSize: number) {
    this.providerProps.vectorSize = vectorSize;
    return (this);
  }

  /**
   * Sets whether to include the text associated
   * with the embeddings in LanceDB.
   * @param includeText whether to include the text
   * associated with the embeddings in LanceDB.
   * @default false
   * @returns the builder instance.
   */
  public withIncludeText(includeText: boolean) {
    this.providerProps.includeText = includeText;
    return (this);
  }

  /**
   * @returns a new instance of the `LanceDbStorageConnector`
   * service constructed with the given parameters.
   */
  public build(): LanceDbStorageConnector {
    return (new LanceDbStorageConnector(
      this.scope,
      this.identifier, {
        ...this.providerProps as LanceDbStorageConnectorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service allowing to integrate vector embeddings
 * with a LanceDB datastore.
 */
export class LanceDbStorageConnector extends Middleware {

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The storage provider to use.
   */
  public storageProvider: LanceDbStorageConnectorProps['storageProvider'];

  /**
   * The builder for the `LanceDbStorageConnector` service.
   */
  public static readonly Builder = LanceDbStorageConnectorBuilder;

  /**
   * LanceDb data store constructor.
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @param props the construct properties.
   */
  constructor(scope: Construct, id: string, props: LanceDbStorageConnectorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        2 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    props = this.parse(LanceDbStorageConnectorPropsSchema, props);

    ///////////////////////////////////////////
    //////    Storage Infrastructure     //////
    ///////////////////////////////////////////

    // Set the storage provider.
    this.storageProvider = props.storageProvider;

    // EFS access point.
    let accessPoint: efs.IAccessPoint | undefined;
    let vpc: ec2.IVpc | undefined;
    if (props.storageProvider.id() === 'EFS_STORAGE') {
      const provider = props.storageProvider as EfsStorageProvider;
      accessPoint = provider.accessPoint;
      vpc = provider.vpc();
    }

    // Ensure the provided VPC matches the storage provider VPC.
    if (vpc && props.vpc && vpc !== props.vpc) {
      throw new Error('The EFS storage provider VPC must match the provided VPC.');
    }

    ///////////////////////////////////////////
    ///////    Processing Function      ///////
    ///////////////////////////////////////////

    this.processor = new node.NodejsFunction(this, 'Processor', {
      description: 'A function writing vector embeddings in a LanceDB table.',
      entry: path.resolve(__dirname, 'lambdas', 'processor', 'index.js'),
      vpc: props.vpc ?? vpc,
      memorySize: props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
      timeout: PROCESSING_TIMEOUT,
      runtime: EXECUTION_RUNTIME,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: props.kmsKey,
      logGroup: this.logGroup,
      filesystem: accessPoint ?
        lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/efs') :
        undefined,
      insightsVersion: props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      environment: {
        POWERTOOLS_SERVICE_NAME: description.name,
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        LAKECHAIN_CACHE_STORAGE: props.cacheStorage.id(),
        LANCEDB_STORAGE: JSON.stringify(props.storageProvider),
        LANCEDB_TABLE_NAME: props.tableName,
        LANCEDB_VECTOR_SIZE: `${props.vectorSize}`,
        INCLUDE_TEXT: props.includeText ? 'true' : 'false'
      },
      layers: [
        LanceDbLayer.arm64(this, 'LanceDbLayer')
      ],
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-s3',
          'vectordb'
        ]
      }
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.processor.grantPrincipal;

    // Storage provider permissions.
    props.storageProvider.grant(this.processor);

    // Plug the SQS queue into the lambda function.
    this.processor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: props.batchSize ?? 10,
      maxBatchingWindow: props.batchingWindow ?? cdk.Duration.seconds(10),
      maxConcurrency: 5
    }));

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

export { S3StorageProvider, EfsStorageProvider } from './definitions/storage';

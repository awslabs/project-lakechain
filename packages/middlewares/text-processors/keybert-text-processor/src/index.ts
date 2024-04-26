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
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { KeybertTextProcessorProps, KeybertTextProcessorPropsSchema } from './definitions/opts';
import { KeybertEmbeddingModel } from './definitions/embedding-model';

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
  name: 'keybert-text-processor',
  description: 'Extracts the main keywords from a text document using the KeyBERT model.',
  version: '0.7.0',
  attrs: {}
};

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.minutes(5);

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE   = 1536;

/**
 * The builder for the `KeybertTextProcessor` service.
 */
class KeybertTextProcessorBuilder extends MiddlewareBuilder {
  private middlewareProps: Partial<KeybertTextProcessorProps> = {};

  /**
   * Sets the maximum number of keywords to extract.
   * @param topN the maximum number of keywords to extract.
   * @default 5
   */
  public withTopN(topN: number) {
    this.middlewareProps.topN = topN;
    return (this);
  }

  /**
   * Sets whether to use the max sum algorithm.
   * @param useMaxSum whether to use the max sum algorithm.
   * @default false
   */
  public withUseMaxSum(useMaxSum: boolean) {
    this.middlewareProps.useMaxSum = useMaxSum;
    return (this);
  }

  /**
   * Sets the diversity of the results between 0 and 1.
   * @param diversity the diversity of the results between 0 and 1.
   * @default 0.5
   */
  public withDiversity(diversity: number) {
    this.middlewareProps.diversity = diversity;
    return (this);
  }

  /**
   * Sets the number of candidates to consider if `useMaxSum` is
   * set to `true`.
   * @param candidates the number of candidates to consider.
   * @default 20
   */
  public withCandidates(candidates: number) {
    this.middlewareProps.candidates = candidates;
    return (this);
  }

  /**
   * Sets the embedding model to be used by KeyBERT.
   * @param embeddingModel name of the model.
   * @default ALL_MINI_LM_L6_V2
   */
  public withEmbeddingModel(embeddingModel: KeybertEmbeddingModel) {
    this.middlewareProps.embeddingModel = embeddingModel;
    return (this);
  }

  /**
   * @returns a new instance of the `KeybertTextProcessor`
   * service constructed with the given parameters.
   */
  public build(): KeybertTextProcessor {
    return (new KeybertTextProcessor(
      this.scope,
      this.identifier, {
        ...this.middlewareProps as KeybertTextProcessorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service providing text modeling capabilities
 * using the KeyBERT model. This middleware will extract
 * the main keywords from a text document and save them
 * in the document metadata.
 */
export class KeybertTextProcessor extends Middleware {

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The builder for the `KeybertTextProcessor` service.
   */
  static Builder = KeybertTextProcessorBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: KeybertTextProcessorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        3 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    this.props = this.parse(KeybertTextProcessorPropsSchema, props);

    ///////////////////////////////////////////
    //////    Middleware Event Handler     ////
    ///////////////////////////////////////////

    // The file system used to cache the KeyBERT model.
    const fileSystem = new efs.FileSystem(this, 'Filesystem', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      vpc: this.props.vpc,
      throughputMode: efs.ThroughputMode.ELASTIC,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED
      },
      encrypted: true,
      kmsKey: this.props.kmsKey
    });

    // Allow services in the VPC to access the EFS.
    fileSystem.connections.allowFrom(
      ec2.Peer.ipv4(this.props.vpc.vpcCidrBlock),
      ec2.Port.tcp(2049),
      'Provides access to the EFS from the VPC.'
    );

    // Create an EFS access point to allow the lambda
    // function to access the EFS.
    const accessPoint = new efs.AccessPoint(this, 'AccessPoint', {
      fileSystem,
      path: '/cache',
      createAcl: {
        ownerGid: '1001',
        ownerUid: '1001',
        permissions: '750'
      },
      posixUser: {
        uid: '1001',
        gid: '1001'
      }
    });

    this.processor = new lambda.DockerImageFunction(this, 'Compute', {
      description: 'A function extracting the main keywords of a text.',
      code: lambda.DockerImageCode.fromImageAsset(
        path.resolve(__dirname, 'lambdas', 'processor')
      ),
      memorySize: props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
      vpc: this.props.vpc,
      timeout: PROCESSING_TIMEOUT,
      architecture: lambda.Architecture.X86_64,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: this.props.kmsKey,
      logGroup: this.logGroup,
      filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/efs'),
      insightsVersion: this.props.cloudWatchInsights ?
        LAMBDA_INSIGHTS_VERSION :
        undefined,
      environment: {
        POWERTOOLS_SERVICE_NAME: description.name,
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        SNS_TARGET_TOPIC: this.eventBus.topicArn,
        TOP_N: `${this.props.topN}`,
        USE_MAX_SUM: `${this.props.useMaxSum}`,
        DIVERSITY: `${this.props.diversity}`,
        CANDIDATES: `${this.props.candidates}`,
        EMBEDDING_MODEL: this.props.embeddingModel.name,
        CACHE_DIR: '/mnt/efs',
        HF_HOME: '/mnt/efs'
      }
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = this.processor.grantPrincipal;

    // Plug the SQS queue into the lambda function.
    this.processor.addEventSource(new sources.SqsEventSource(this.eventQueue, {
      batchSize: this.props.batchSize ?? 1,
      reportBatchItemFailures: true
    }));

    // Grant the compute type permissions to
    // publish to the SNS topic.
    this.eventBus.grantPublish(this.grantPrincipal);

    super.bind();
  }

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  grantReadProcessedDocuments(grantee: iam.IGrantable): iam.Grant {
    // Since this middleware simply passes through the data
    // from the previous middleware, we grant any subsequent
    // middlewares in the pipeline to have read access to the
    // data of all source middlewares.
    for (const source of this.sources) {
      source.grantReadProcessedDocuments(grantee);
    }
    return ({} as iam.Grant);
  }

  /**
   * @returns an array of mime-types supported as input
   * type by this middleware.
   */
  supportedInputTypes(): string[] {
    return ([
      'text/plain'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return ([
      'text/plain'
    ]);
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

export { KeybertEmbeddingModel } from './definitions/embedding-model';

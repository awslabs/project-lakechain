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
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as assets from 'aws-cdk-lib/aws-ecr-assets';
import * as efs from 'aws-cdk-lib/aws-efs';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { Middleware, MiddlewareBuilder } from '@project-lakechain/core/middleware';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { EcsCluster } from '@project-lakechain/ecs-cluster';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { SentenceTransformersModel } from './definitions/model';
import { SentenceTransformersProps, SentenceTransformersPropsSchema } from './definitions/opts';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'sentence-transformers',
  description: 'Creates embeddings from text-oriented documents using Sentence Transformers models.',
  version: '0.7.0',
  attrs: {}
};

/**
 * The instance type to use for the container instances.
 */
const DEFAULT_INSTANCE_TYPE = ec2.InstanceType.of(
  ec2.InstanceClass.G4DN,
  ec2.InstanceSize.XLARGE
);

/**
 * The maximum time the processing lambda
 * is allowed to run.
 */
const PROCESSING_TIMEOUT = cdk.Duration.minutes(5);

/**
 * The default memory size to allocate for the compute.
 */
const DEFAULT_MEMORY_SIZE = 4096;

/**
 * The builder for the `SentenceTransformers` service.
 */
class SentenceTransformersBuilder extends MiddlewareBuilder {
  private providerProps: Partial<SentenceTransformersProps> = {};

  /**
   * Sets the embedding model to use.
   * @param model the embedding model to use.
   */
  public withModel(model: SentenceTransformersModel) {
    this.providerProps.model = model;
    return (this);
  }

  /**
   * The maximum amount of instances the
   * cluster can have. Keep this number to
   * a reasonable value to avoid over-provisioning
   * the cluster.
   * @param maxInstances the maximum amount of instances.
   * @default 5
   */
  public withMaxInstances(maxInstances: number) {
    this.providerProps.maxInstances = maxInstances;
    return (this);
  }

  /**
   * @returns a new instance of the `SentenceTransformers`
   * service constructed with the given parameters.
   */
  public build(): SentenceTransformers {
    return (new SentenceTransformers(
      this.scope,
      this.identifier, {
        ...this.providerProps as SentenceTransformersProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service allowing to create embeddings for text
 * chunks using a sentence transformers model.
 */
export class SentenceTransformers extends Middleware {

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The builder for the `SentenceTransformers` service.
   */
  static Builder = SentenceTransformersBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: SentenceTransformersProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    this.props = this.parse(SentenceTransformersPropsSchema, props);

    ///////////////////////////////////////////
    //////    Middleware Event Handler     ////
    ///////////////////////////////////////////

    // The container image to provision the ECS tasks with.
    const image = ecs.ContainerImage.fromDockerImageAsset(
      new assets.DockerImageAsset(this, 'Container', {
        directory: path.resolve(__dirname, 'container'),
        platform: assets.Platform.LINUX_AMD64
      })
    );

    // Use the ECS container middleware pattern to create an
    // auto-scaled ECS cluster, an EFS mounted on the cluster's tasks
    // and all the components required to manage the cluster.
    const cluster = new EcsCluster(this, 'Cluster', {
      vpc: this.props.vpc,
      eventQueue: this.eventQueue,
      eventBus: this.eventBus,
      kmsKey: this.props.kmsKey,
      logGroup: this.logGroup,
      containerProps: {
        image,
        containerName: 'sentence-transformers',
        cpuLimit: 2048,
        memoryLimitMiB: this.props.maxMemorySize ?? DEFAULT_MEMORY_SIZE,
        gpuCount: 1,
        environment: {
          POWERTOOLS_SERVICE_NAME: description.name,
          LAKECHAIN_CACHE_STORAGE: this.props.cacheStorage.id(),
          EMBEDDING_MODEL: this.props.model.name,
          CACHE_DIR: '/cache',
          HF_HOME: '/cache'
        }
      },
      autoScaling: {
        minInstanceCapacity: 0,
        maxInstanceCapacity: this.props.maxInstances,
        maxTaskCapacity: this.props.maxInstances,
        maxMessagesPerTask: 10
      },
      launchTemplateProps: {
        instanceType: DEFAULT_INSTANCE_TYPE,
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(
          ecs.AmiHardwareType.GPU
        ),
        userData: ec2.UserData.forLinux()
      },
      fileSystem: {
        throughputMode: efs.ThroughputMode.ELASTIC,
        readonly: false,
        containerPath: '/cache',
        accessPoint: {
          uid: 1000,
          gid: 1000,
          permission: 750
        }
      },
      containerInsights: this.props.cloudWatchInsights
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = cluster.taskRole.grantPrincipal;

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
      'text/plain',
      'text/markdown'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return (this.supportedInputTypes());
  }

  /**
   * @returns the supported compute types by a given
   * middleware.
   */
  supportedComputeTypes(): ComputeType[] {
    return ([
      ComputeType.GPU
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

export { SentenceTransformersModel } from './definitions/model';
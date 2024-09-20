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
import * as assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as efs from 'aws-cdk-lib/aws-efs';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { EcsCluster } from '@project-lakechain/ecs-cluster';
import { OllamaEmbeddingModel } from './definitions/model';
import { getConfiguration } from './definitions/ecs-configuration';
import { InfrastructureDefinition } from './definitions/infrastructure';

import {
  OllamaEmbeddingProcessorProps,
  OllamaEmbeddingProcessorPropsSchema
} from './definitions/opts';
import {
  Middleware,
  MiddlewareBuilder
} from '@project-lakechain/core/middleware';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'ollama-embedding-processor',
  description: 'Creates embeddings from documents using Ollama models.',
  version: '0.10.0',
  attrs: {}
};

/**
 * The number of parallel models to be loaded in memory
 * by Ollama.
 */
const OLLAMA_MAX_LOADED_MODELS = 1;

/**
 * The builder class for the `OllamaEmbeddingProcessor` service.
 */
class OllamaEmbeddingProcessorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<OllamaEmbeddingProcessorProps> = {};

  /**
   * Sets the Ollama embedding model to use.
   * @param model the identifier of the Ollama embedding model to use.
   * @see https://ollama.com/library
   * @returns the builder instance.
   */
  public withModel(model: OllamaEmbeddingModel) {
    this.providerProps.model = model;
    return (this);
  }

  /**
   * Sets the infrastructure to use to run the ollama model.
   * @param instanceType the instance type to use.
   * @returns the builder instance.
   */
  public withInfrastructure(infrastructure: InfrastructureDefinition) {
    this.providerProps.infrastructure = infrastructure;
    return (this);
  }

  /**
   * @returns a new instance of the `OllamaEmbeddingProcessor`
   * service constructed with the given parameters.
   */
  public build(): OllamaEmbeddingProcessor {
    return (new OllamaEmbeddingProcessor(
      this.scope,
      this.identifier, {
        ...this.providerProps as OllamaEmbeddingProcessorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service allowing to embed documents using
 * embedding models supported by Ollama.
 */
export class OllamaEmbeddingProcessor extends Middleware {

  /**
   * The builder for the `OllamaEmbeddingProcessor` service.
   */
  public static readonly Builder = OllamaEmbeddingProcessorBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: OllamaEmbeddingProcessorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.minutes(2)
    });

    // Validate the properties.
    this.props = this.parse(OllamaEmbeddingProcessorPropsSchema, props);

    ///////////////////////////////////////////
    /////////      ECS Container      /////////
    ///////////////////////////////////////////

    // Create the configuration for the ECS cluster.
    const configuration = getConfiguration(this.props.infrastructure);

    // The container image to provision the ECS tasks with.
    const image = ecs.ContainerImage.fromDockerImageAsset(
      new assets.DockerImageAsset(this, 'OllamaEmbeddingImage', {
        directory: path.resolve(__dirname, 'container'),
        platform: configuration.container.platform
      })
    );

    // Use the ECS container middleware pattern to create an
    // auto-scaled ECS cluster, an EFS mounted on the cluster's tasks
    // and all the components required to manage the cluster.
    // This cluster supports both CPU and GPU instances.
    const cluster = new EcsCluster(this, 'Cluster', {
      vpc: this.props.vpc,
      eventQueue: this.eventQueue,
      eventBus: this.eventBus,
      kmsKey: this.props.kmsKey,
      logGroup: this.logGroup,
      containerProps: {
        image,
        containerName: 'ollama-embedding-processor',
        memoryLimitMiB: configuration.memoryLimitMiB,
        gpuCount: configuration.gpuCount,
        environment: {
          POWERTOOLS_SERVICE_NAME: description.name,
          LAKECHAIN_CACHE_STORAGE: this.props.cacheStorage.id(),
          OLLAMA_MODEL: `${this.props.model.name}:${this.props.model.definition.tag}`,
          OLLAMA_MODELS: '/cache',
          OLLAMA_NUM_PARALLEL: `${this.props.batchSize}`,
          OLLAMA_MAX_LOADED_MODELS: `${OLLAMA_MAX_LOADED_MODELS}`
        }
      },
      autoScaling: {
        minInstanceCapacity: 0,
        maxInstanceCapacity: this.props.maxConcurrency,
        maxTaskCapacity: this.props.maxConcurrency,
        maxMessagesPerTask: this.props.batchSize,
      },
      launchTemplateProps: {
        instanceType: configuration.instanceType,
        machineImage: configuration.machineImage,
        ebsOptimized: true,
        blockDevices: [{
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(80)
        }],
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
    return (this.props.model.definition.inputs);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return (this.props.model.definition.outputs);
  }

  /**
   * @returns the supported compute types by a given
   * middleware.
   */
  supportedComputeTypes(): ComputeType[] {
    return ([
      ComputeType.CPU,
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

export { OllamaEmbeddingModel } from './definitions/model';
export { InfrastructureDefinition } from './definitions/infrastructure';

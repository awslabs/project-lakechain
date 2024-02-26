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
import * as lambda from 'aws-cdk-lib/aws-lambda';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CacheStorage } from '@project-lakechain/core';
import { OllamaProcessorProps, OllamaProcessorPropsSchema } from './definitions/opts';
import { Middleware, MiddlewareBuilder } from '@project-lakechain/core/middleware';
import { EcsCluster } from '@project-lakechain/ecs-cluster';
import { OllamaModel } from './definitions/model';
import { getConfiguration } from './definitions/ecs-configuration';
import { InfrastructureDefinition } from './definitions/infrastructure';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'ollama-processor',
  description: 'Processes documents using models supported by Ollama.',
  version: '0.4.0',
  attrs: {}
};

/**
 * The builder class for the `OllamaProcessor` service.
 */
class OllamaProcessorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<OllamaProcessorProps> = {};

  /**
   * Sets the Ollama model to use.
   * @param model the identifier of the Ollama model to use.
   * @see https://ollama.com/library
   * @returns the builder instance.
   */
  public withModel(model: OllamaModel) {
    this.providerProps.model = model;
    return (this);
  }

  /**
   * Sets the prompt to apply to input documents.
   * @param prompt the prompt to use.
   * @returns the builder instance.
   */
  public withPrompt(prompt: string) {
    this.providerProps.prompt = prompt;
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
   * @returns a new instance of the `OllamaProcessor`
   * service constructed with the given parameters.
   */
  public build(): OllamaProcessor {
    return (new OllamaProcessor(
      this.scope,
      this.identifier, {
        ...this.providerProps as OllamaProcessorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service allowing to process documents using
 * models supported by Ollama.
 */
export class OllamaProcessor extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The builder for the `OllamaProcessor` service.
   */
  static Builder = OllamaProcessorBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: OllamaProcessorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.minutes(30)
    });

    // Validate the properties.
    this.props = this.parse(OllamaProcessorPropsSchema, props);

    ///////////////////////////////////////////
    /////////    Processing Storage      //////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: this.props.kmsKey
    });

    ///////////////////////////////////////////
    /////////      ECS Container      /////////
    ///////////////////////////////////////////

    // The configuration to use for the specified compute type.
    const configuration = getConfiguration(this.props.infrastructure);

    // The container image to provision the ECS tasks with.
    const image = ecs.ContainerImage.fromDockerImageAsset(
      new assets.DockerImageAsset(this, 'OllamaImage', {
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
        containerName: 'ollama-processor',
        memoryLimitMiB: configuration.memoryLimitMiB,
        gpuCount: configuration.gpuCount,
        environment: {
          POWERTOOLS_SERVICE_NAME: description.name,
          PROCESSED_FILES_BUCKET: this.storage.id(),
          OLLAMA_PROMPT: this.props.prompt,
          OLLAMA_MODEL: `${this.props.model.name}:${this.props.model.definition.tag}`,
          OLLAMA_MODELS: '/cache'
        }
      },
      autoScaling: {
        minInstanceCapacity: 0,
        maxInstanceCapacity: this.props.maxInstances,
        maxTaskCapacity: this.props.maxInstances,
        maxMessagesPerTask: 2
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

    // Cluster permissions.
    this.storage.grantWrite(cluster.taskRole);

    super.bind();
  }

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  grantReadProcessedDocuments(grantee: iam.IGrantable): iam.Grant {
    return (this.storage.grantRead(grantee));
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

export { OllamaModel } from './definitions/model';
export { InfrastructureDefinition } from './definitions/infrastructure';

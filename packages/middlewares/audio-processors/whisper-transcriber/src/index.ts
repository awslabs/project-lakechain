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
import { Middleware, MiddlewareBuilder } from '@project-lakechain/core/middleware';
import { EcsCluster } from '@project-lakechain/ecs-cluster';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CacheStorage } from '@project-lakechain/core';
import { WhisperTranscriberPropsSchema, WhisperTranscriberProps } from './definitions/opts';
import { WhisperEngine } from './definitions/whisper-engine';
import { WhisperModel } from './definitions/whisper-model';
import { OutputFormat } from './definitions/output-format';
import { getCpuConfiguration, getGpuConfiguration } from './definitions/infrastructure';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'whisper-transcriber',
  description: 'An audio document transcription middleware based on OpenAI Whisper.',
  version: '0.10.0',
  attrs: {}
};

/**
 * The builder class for the `WhisperTranscriber` service.
 */
class WhisperTranscriberBuilder extends MiddlewareBuilder {
  private whisperProps: Partial<WhisperTranscriberProps> = {};

  /**
   * Sets the Whisper engine to use.
   * @param engine the Whisper engine to use.
   * @default openai_whisper
   */
  public withEngine(engine: WhisperEngine) {
    this.whisperProps.engine = engine;
    return (this);
  }

  /**
   * Sets the Whisper model to use.
   * @param model the Whisper model to use.
   * @default small
   */
  public withModel(model: WhisperModel) {
    this.whisperProps.model = model;
    return (this);
  }

  /**
   * Sets the output format to use.
   * @param format the output format to use.
   * @default vtt
   */
  public withOutputFormat(format: OutputFormat) {
    this.whisperProps.outputFormat = format;
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
    this.whisperProps.maxInstances = maxInstances;
    return (this);
  }

  /**
   * @returns a new instance of the `WhisperTranscriber`
   * service constructed with the given parameters.
   */
  public build(): WhisperTranscriber {
    return (new WhisperTranscriber(
      this.scope,
      this.identifier, {
        ...this.whisperProps as WhisperTranscriberProps,
        ...this.props
      }
    ));
  }
}

/**
 * The Whisper transcriber middleware handles the task of transcribing
 * audio documents into text documents using the Whisper model.
 */
export class WhisperTranscriber extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The builder for the `WhisperTranscriber` service.
   */
  public static readonly Builder = WhisperTranscriberBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: WhisperTranscriberProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.minutes(30)
    });

    // Validate the properties.
    this.props = this.parse(WhisperTranscriberPropsSchema, props);

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
    const configuration = this.props.computeType === ComputeType.CPU ?
      getCpuConfiguration(this.props.model) :
      getGpuConfiguration(this.props.model);

    // The container image to provision the ECS tasks with.
    const image = ecs.ContainerImage.fromDockerImageAsset(
      new assets.DockerImageAsset(this, 'WhisperImage', {
        directory: path.resolve(__dirname, 'container'),
        file: configuration.container.dockerFile,
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
        containerName: 'whisper-processor',
        cpuLimit: configuration.cpuLimit,
        memoryLimitMiB: configuration.memoryLimitMiB,
        gpuCount: configuration.gpuCount,
        environment: {
          POWERTOOLS_SERVICE_NAME: description.name,
          WHISPER_ENGINE: this.props.engine,
          WHISPER_MODEL: this.props.model,
          OUTPUT_FORMAT: this.props.outputFormat,
          PROCESSED_FILES_BUCKET: this.storage.id()
        }
      },
      autoScaling: {
        minInstanceCapacity: 0,
        maxInstanceCapacity: this.props.maxInstances,
        maxTaskCapacity: this.props.maxInstances,
        maxMessagesPerTask: 1
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
    return ([
      'audio/mpeg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/wav',
      'audio/webm',
      'audio/flac',
      'audio/x-flac'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return ([
      'application/x-subrip',
      'text/vtt',
      'text/plain',
      'text/tab-separated-values',
      'application/json'
    ]);
  }

  /**
   * @returns the supported compute types by a given
   * middleware.
   */
  supportedComputeTypes(): ComputeType[] {
    return ([
      ComputeType.GPU,
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

export { WhisperModel } from './definitions/whisper-model';
export { WhisperEngine } from './definitions/whisper-engine';
export { OutputFormat } from './definitions/output-format';

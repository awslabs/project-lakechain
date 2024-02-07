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
import voices from './container/app/voices.json';

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
import { BarkSynthesizerPropsSchema, BarkSynthesizerProps } from './definitions/opts';
import { getGpuConfiguration } from './definitions/infrastructure';
import { BarkVoice } from './definitions/voice';
import { BarkLanguage } from './definitions/language';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'bark-synthesizer',
  description: 'Synthesize text to audio using the Bark model.',
  version: '0.1.0',
  attrs: {}
};

/**
 * The builder class for the `BarkSynthesizer` service.
 */
class BarkSynthesizerBuilder extends MiddlewareBuilder {
  private providerProps: Partial<BarkSynthesizerProps> = {};

  /**
   * Builder constructor.
   */
  constructor() {
    super();
    this.providerProps.voiceMapping = {};
  }

  /**
   * Specifies the language to assume the source
   * document being written in.
   * @param language the language to assume.
   * @returns the builder itself.
   */
  public withLanguageOverride(language: BarkLanguage) {
    this.providerProps.languageOverride = language;
    return (this);
  }

  /**
   * Specifies a mapping between a language and a voice descriptor.
   * @param language the language to map.
   * @param voice the voice descriptor to map.
   * @see https://suno-ai.notion.site/8b8e8749ed514b0cbf3f699013548683?v=bc67cff786b04b50b3ceb756fd05f68c
   * @returns the builder itself.
   */
  public withVoiceMapping(language: BarkLanguage, ...voiceArray: BarkVoice[]) {
    const languageVoices = this.providerProps.voiceMapping![language];

    // Verify that the voices match the given language.
    const incompatibleVoices = voiceArray.filter(voice =>
      !voices
        .filter(voice => voice.LanguageCode === language)
        .find(v => v.Id === voice)
    );

    // Throw an error if there are incompatible voices.
    if (incompatibleVoices.length > 0) {
      throw new Error(
        `The following voices are not available for the language ${language}: ` +
        `${incompatibleVoices.join(', ')}`
      );
    }

    if (languageVoices) {
      this.providerProps.voiceMapping![language] = [
        ...languageVoices,
        ...voiceArray
      ];
      return (this);
    }
    this.providerProps.voiceMapping![language] = voiceArray;
    return (this);
  }

  /**
   * Specifies the temperature to pass to the Bark generative model
   * when generating text to speech.
   * @param temperature the temperature to use.
   * @returns the builder itself.
   */
  public withTemperature(temperature: number) {
    this.providerProps.temperature = temperature;
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
   * @returns a new instance of the `BarkSynthesizer`
   * service constructed with the given parameters.
   */
  public build(): BarkSynthesizer {
    return (new BarkSynthesizer(
      this.scope,
      this.identifier, {
        ...this.providerProps as BarkSynthesizerProps,
        ...this.props
      }
    ));
  }
}

/**
 * The Bark synthesizer middleware allows to synthesize
 * text to audio using the Bark model.
 */
export class BarkSynthesizer extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The builder for the `BarkSynthesizer` service.
   */
  static Builder = BarkSynthesizerBuilder;

  /**
   * Provider constructor.
   */
  constructor(scope: Construct, id: string, private props: BarkSynthesizerProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.minutes(45)
    });

    // Validate the properties.
    this.props = this.parse(BarkSynthesizerPropsSchema, props);

    ///////////////////////////////////////////
    ////////    Processing Storage      ///////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: this.props.kmsKey
    });

    ///////////////////////////////////////////
    /////////      ECS Container      /////////
    ///////////////////////////////////////////

    // The configuration to use for GPU.
    const configuration = getGpuConfiguration();

    // The container image to provision the ECS tasks with.
    const image = ecs.ContainerImage.fromDockerImageAsset(
      new assets.DockerImageAsset(this, 'BarkImage', {
        directory: path.resolve(__dirname, 'container'),
        file: configuration.container.dockerFile,
        platform: configuration.container.platform
      })
    );

    // The environment variables to pass to the container.
    const environment: {[key: string]: string} = {
      POWERTOOLS_SERVICE_NAME: description.name,
      PROCESSED_FILES_BUCKET: this.storage.id(),
      TEMPERATURE: `${this.props.temperature}`,
      HF_HOME: '/cache',
      XDG_CACHE_HOME: '/cache',
      VOICE_MAPPING: JSON.stringify(this.props.voiceMapping)
    };

    // Use the ECS container middleware pattern to create an
    // auto-scaled ECS cluster, an EFS mounted on the cluster's tasks
    // and all the components required to manage the cluster.
    // This cluster supports both CPU and GPU instances.
    const cluster = new EcsCluster(this, 'Cluster', {
      vpc: this.props.vpc,
      eventQueue: this.eventQueue,
      eventBus: this.eventBus,
      kmsKey: props.kmsKey,
      logGroup: this.logGroup,
      containerProps: {
        image,
        containerName: description.name,
        cpuLimit: configuration.cpuLimit,
        memoryLimitMiB: configuration.memoryLimitMiB,
        gpuCount: configuration.gpuCount,
        environment
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
      'text/plain'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return ([
      'audio/mpeg'
    ]);
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

export * as dsl from './definitions';
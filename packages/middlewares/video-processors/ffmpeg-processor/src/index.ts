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
import serialize from 'serialize-javascript';

import * as cdk from 'aws-cdk-lib';
import * as assets from 'aws-cdk-lib/aws-ecr-assets';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as esbuild from 'esbuild';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CacheStorage } from '@project-lakechain/core';
import { Middleware, MiddlewareBuilder } from '@project-lakechain/core/middleware';
import { EcsCluster } from '@project-lakechain/ecs-cluster';
import { InfrastructureDefinition } from './definitions/infrastructure';
import { getConfiguration } from './definitions/ecs-configuration';

import {
  FfmpegProcessorProps,
  FfmpegProcessorPropsSchema,
  IntentExpression
} from './definitions/opts';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'ffmpeg-processor',
  description: 'Processes media documents using FFMPEG.',
  version: '0.10.0',
  attrs: {}
};

/**
 * The name of the callable expression to invoke
 * the user-provided intent.
 */
const INTENT_SYMBOL = '__callable';

/**
 * The builder class for the `FfmpegProcessor` service.
 */
class FfmpegProcessorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<FfmpegProcessorProps> = {};

  /**
   * Sets the intent expression to use to execute the FFMPEG document
   * processing.
   * @param intent the intent expression to use.
   * @returns the builder instance.
   */
  public withIntent(intent: IntentExpression) {
    this.providerProps.intent = intent;
    return (this);
  }

  /**
   * Sets the infrastructure to use to run FFMPEG.
   * @param infrastructure the infrastructure to use.
   * @returns the builder instance.
   * @default c6a.xlarge
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
   * @returns a new instance of the `FfmpegProcessor`
   * service constructed with the given parameters.
   */
  public build(): FfmpegProcessor {
    return (new FfmpegProcessor(
      this.scope,
      this.identifier, {
        ...this.providerProps as FfmpegProcessorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A service allowing to process documents using
 * FFMPEG.
 */
export class FfmpegProcessor extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The builder for the `FfmpegProcessor` service.
   */
  public static readonly Builder = FfmpegProcessorBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: FfmpegProcessorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.minutes(30)
    });

    // Validate the properties.
    this.props = this.parse(FfmpegProcessorPropsSchema, props);

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
      new assets.DockerImageAsset(this, 'FfmpegImage', {
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
        containerName: 'ffmpeg-processor',
        memoryLimitMiB: configuration.memoryLimitMiB,
        gpuCount: configuration.gpuCount,
        environment: {
          POWERTOOLS_SERVICE_NAME: description.name,
          AWS_REGION: cdk.Stack.of(this).region,
          AWS_XRAY_CONTEXT_MISSING: 'IGNORE_ERROR',
          AWS_XRAY_LOG_LEVEL: 'silent',
          PROCESSED_FILES_BUCKET: this.storage.id(),
          INTENT: this.serializeFn(this.props.intent),
          INTENT_SYMBOL
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
      containerInsights: this.props.cloudWatchInsights,
      xraySidecar: true
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
   * A helper used to serialize the user-provided intent into a string.
   * This function also uses `esbuild` to validate the syntax of the
   * provided function and minify it.
   * @param fn the function to serialize.
   * @param opts the esbuild transform options.
   * @returns the serialized function.
   */
  private serializeFn(fn: IntentExpression, opts?: esbuild.TransformOptions): string {
    const res = esbuild.transformSync(`const ${INTENT_SYMBOL} = ${serialize(fn)}\n`, {
      minify: true,
      ...opts
    });
    return (res.code);
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
      // Video.
      'video/mpeg',
      'video/mp4',
      'video/x-m4v',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/MP2T',
      'video/x-ms-wmv',
      'video/x-flv',
      // Audio.
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/x-wav',
      'audio/x-m4a',
      'audio/ogg',
      'audio/x-flac',
      'audio/flac',
      'audio/x-aiff',
      'audio/aiff',
      'audio/x-ms-wma',
      'audio/x-matroska',
      'audio/webm',
      'audio/aac',
      // Aggregated events.
      'application/cloudevents+json'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return ([
      // Video.
      'video/mpeg',
      'video/mp4',
      'video/x-m4v',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/MP2T',
      'video/x-ms-wmv',
      'video/x-flv',
      // Audio.
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/x-wav',
      'audio/x-m4a',
      'audio/ogg',
      'audio/x-flac',
      'audio/flac',
      'audio/x-aiff',
      'audio/aiff',
      'audio/x-ms-wma',
      'audio/x-matroska',
      'audio/webm',
      'audio/aac'
    ]);
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

export { InfrastructureDefinition } from './definitions/infrastructure';
export {
  CloudEvent,
  FfmpegUtils,
  FfmpegCommand,
  FfmpegCommandOptions,
  Ffmpeg
} from './definitions/opts';

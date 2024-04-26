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
import { Blip2ImageProcessorProps, Blip2ImageProcessorPropsSchema } from './definitions/opts';

/**
 * The service description.
 */
const description: ServiceDescription = {
  name: 'blip2-image-processor',
  description: 'Extracts image captioning information from images using the Blip2 model.',
  version: '0.7.0',
  attrs: {}
};

/**
 * The instance type to use for the container instances.
 * Running the Blip2 model requires a lot of RAM and VRAM,
 * which the reason why the underlying ECS cluster uses
 * G4 2xlarge EC2 instances by default.
 */
const DEFAULT_INSTANCE_TYPE = ec2.InstanceType.of(
  ec2.InstanceClass.G5,
  ec2.InstanceSize.XLARGE2
);

/**
 * Builder for the `Blip2ImageProcessor` middleware.
 */
class Blip2ImageProcessorBuilder extends MiddlewareBuilder {
  private providerProps: Partial<Blip2ImageProcessorProps> = {};

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
   * @returns a new instance of the `Blip2ImageProcessor`
   * service constructed with the given parameters.
   */
  public build(): Blip2ImageProcessor {
    return (new Blip2ImageProcessor(
      this.scope,
      this.identifier, {
        ...this.providerProps as Blip2ImageProcessorProps,
        ...this.props
      }
    ));
  }
}

/**
 * A middleware that expects images and produces textual
 * description of the image that is used to enrich the
 * document metadata.
 */
export class Blip2ImageProcessor extends Middleware {

  /**
   * The builder for the `Blip2ImageProcessor` service.
   */
  static Builder = Blip2ImageProcessorBuilder;

  constructor(scope: Construct, id: string, props: Blip2ImageProcessorProps) {
    super(scope, id, description, props);

    // Validate the properties.
    props = this.parse(Blip2ImageProcessorPropsSchema, props);

    ////////////////////////////////////////////
    //////   ECS Cluster Configuration      ////
    ////////////////////////////////////////////

    // The container image to provision the ECS tasks with.
    const image = ecs.ContainerImage.fromDockerImageAsset(
      new assets.DockerImageAsset(this, 'TextMetadataContainer', {
        directory: path.resolve(__dirname, 'container'),
        platform: assets.Platform.LINUX_AMD64
      })
    );

    // Use the ECS container middleware pattern to create an
    // auto-scaled ECS cluster, an EFS mounted on the cluster's tasks
    // and all the components required to manage the cluster.
    const cluster = new EcsCluster(this, 'Cluster', {
      vpc: props.vpc,
      eventQueue: this.eventQueue,
      eventBus: this.eventBus,
      kmsKey: props.kmsKey,
      logGroup: this.logGroup,
      containerProps: {
        image,
        containerName: 'blip2-metadata-extractor',
        cpuLimit: 8192,
        memoryLimitMiB: 30000,
        gpuCount: 1,
        environment: {
          POWERTOOLS_SERVICE_NAME: description.name,
          HF_HOME: '/cache'
        }
      },
      autoScaling: {
        minInstanceCapacity: 0,
        maxInstanceCapacity: props.maxInstances,
        maxTaskCapacity: props.maxInstances,
        maxMessagesPerTask: 10
      },
      launchTemplateProps: {
        instanceType: DEFAULT_INSTANCE_TYPE,
        machineImage: ecs.EcsOptimizedImage.amazonLinux2(
          ecs.AmiHardwareType.GPU
        ),
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
      containerInsights: props.cloudWatchInsights
    });

    // Allows this construct to act as a `IGrantable`
    // for other middlewares to grant the processing
    // lambda permissions to access their resources.
    this.grantPrincipal = cluster.taskRole.grantPrincipal;

    super.bind();
  }

  /**
   * Allows a grantee to read from the processed documents
   * generated by this middleware.
   */
  grantReadProcessedDocuments(grantee: iam.IGrantable): iam.Grant {
    // Since this middleware simply passes through the data
    // from the previous middleware, we grant any subsequent
    // middlewares in the pipeline read access to the
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
      'image/bmp',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/webp',
      'image/x-pcx'
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

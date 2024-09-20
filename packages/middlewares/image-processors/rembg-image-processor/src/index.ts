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
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as assets from 'aws-cdk-lib/aws-ecr-assets';

import { Construct } from 'constructs';
import { ServiceDescription } from '@project-lakechain/core/service';
import { ComputeType } from '@project-lakechain/core/compute-type';
import { EcsCluster } from '@project-lakechain/ecs-cluster';
import { when } from '@project-lakechain/core/dsl/vocabulary/conditions';
import { CacheStorage } from '@project-lakechain/core';

import {
  RembgImageProcessorProps,
  RembgImageProcessorPropsSchema
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
  name: 'rembg-image-processor',
  description: 'Automatically remove background from images using the Rembg.',
  version: '0.10.0',
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
 * The default memory size to allocate for the CPU compute.
 */
const DEFAULT_MEMORY_SIZE_CPU = 2048;

/**
 * The default memory size to allocate for the GPU compute.
 */
const DEFAULT_MEMORY_SIZE_GPU = 15000;

/**
 * The builder for the `RembgImageProcessor` service.
 */
class RembgImageProcessorBuilder extends MiddlewareBuilder {
  private middlewareProps: Partial<RembgImageProcessorProps> = {};

  /**
   * The maximum amount of instances the
   * cluster can have. Keep this number to
   * a reasonable value to avoid over-provisioning
   * the cluster.
   * @param maxInstances the maximum amount of instances.
   * @default 5
   * @returns the builder instance.
   */
  public withMaxInstances(maxInstances: number) {
    this.middlewareProps.maxInstances = maxInstances;
    return (this);
  }

  /**
   * Whether to enable alpha matting.
   * @param alphaMatting a boolean indicating whether
   * to enable alpha matting.
   * @returns the builder instance.
   */
  public withAlphaMatting(alphaMatting: boolean) {
    this.middlewareProps.alphaMatting = alphaMatting;
    return (this);
  }

  /**
   * Foreground threshold for alpha matting.
   * @param threshold the foreground threshold.
   * @default 240
   * @returns the builder instance.
   */
  public withAlphaMattingForegroundThreshold(threshold: number) {
    this.middlewareProps.alphaMattingForegroundThreshold = threshold;
    return (this);
  }

  /**
   * Background threshold for alpha matting.
   * @param threshold the background threshold.
   * @default 10
   * @returns the builder instance.
   */
  public withAlphaMattingBackgroundThreshold(threshold: number) {
    this.middlewareProps.alphaMattingBackgroundThreshold = threshold;
    return (this);
  }

  /**
   * Erosion size for alpha matting.
   * @param size the erosion size.
   * @default 10
   * @returns the builder instance.
   */
  public withAlphaMattingErosionSize(size: number) {
    this.middlewareProps.alphaMattingErosionSize = size;
    return (this);
  }

  /**
   * Whether to enable mask post-processing.
   * @param maskPostProcessing a boolean indicating whether
   * to enable mask post-processing.
   * @default false
   * @returns the builder instance.
   */
  public withMaskPostProcessing(maskPostProcessing: boolean) {
    this.middlewareProps.maskPostProcessing = maskPostProcessing;
    return (this);
  }

  /**
   * @returns a new instance of the `RembgImageProcessor`
   * service constructed with the given parameters.
   */
  public build(): RembgImageProcessor {
    const props = RembgImageProcessorPropsSchema.parse({
      ...this.middlewareProps,
      ...this.props
    });

    return (new RembgImageProcessor(
      this.scope,
      this.identifier, {
        ...this.middlewareProps as RembgImageProcessorProps,
        ...props
      }
    ));
  }
}

/**
 * A service providing automatic background removal
 * from images using the Rembg library.
 * @see https://github.com/danielgatis/rembg/tree/main
 */
export class RembgImageProcessor extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The builder for the `RembgImageProcessor` service.
   */
  public static readonly Builder = RembgImageProcessorBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: RembgImageProcessorProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        3 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    this.props = this.parse(RembgImageProcessorPropsSchema, props);

    ///////////////////////////////////////////
    /////////    Processing Storage      //////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: props.kmsKey
    });

    ///////////////////////////////////////////
    ///////    Parameter Validation      //////
    ///////////////////////////////////////////

    if (this.props.alphaMatting === true) {
      // If the user is using alpha matting with a CPU compute, and the
      // `maxMemorySize` is not set or is less than 10240 MB, we throw an error
      // to prevent the user from running the service with insufficient memory.
      if ((!this.props.maxMemorySize || this.props.maxMemorySize < 10240)
        && (!this.props.computeType || this.props.computeType === ComputeType.CPU)) {
        throw new Error(`
          The minimum memory size for alpha matting is 10240 MB of memory.
          Please increase the memory size using the 'withMaxMemorySize' method.
        `);
      }
    }

    ///////////////////////////////////////////
    //////    Middleware Event Handler     ////
    ///////////////////////////////////////////

    if (this.props.computeType === ComputeType.GPU) {
      this.createGpuImpl();
    } else {
      this.createCpuImpl();
    }

    // Grant the compute type permissions to
    // write to the post-processing bucket.
    this.storage.grantWrite(this.grantPrincipal);

    // Grant the compute type permissions to
    // publish to the SNS topic.
    this.eventBus.grantPublish(this.grantPrincipal);

    super.bind();
  }

  /**
   * Creates the CPU infrastructure for running RunBg on images
   * from the input queue.
   */
  private createCpuImpl() {
    const fileSystem = new efs.FileSystem(this, 'Filesystem', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      vpc: this.props.vpc,
      throughputMode: efs.ThroughputMode.ELASTIC,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED
      },
      lifecyclePolicy: efs.LifecyclePolicy.AFTER_7_DAYS,
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

    // The processing function.
    this.processor = new lambda.DockerImageFunction(this, 'Compute', {
      description: 'A function removing the background from images.',
      code: lambda.DockerImageCode.fromImageAsset(
        path.resolve(__dirname, 'lambdas', 'processor')
      ),
      memorySize: this.props.maxMemorySize ?? DEFAULT_MEMORY_SIZE_CPU,
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
        PROCESSED_FILES_BUCKET: this.storage.id(),
        ALPHA_MATTING: this.props.alphaMatting ? 'true' : 'false',
        ALPHA_MATTING_FG_THRESHOLD: this.props.alphaMattingForegroundThreshold?.toString(),
        ALPHA_MATTING_BG_THRESHOLD: this.props.alphaMattingBackgroundThreshold?.toString(),
        ALPHA_MATTING_EROSION_SIZE: this.props.alphaMattingErosionSize?.toString(),
        MASK_POST_PROCESSING: this.props.maskPostProcessing ? 'true' : 'false',
        U2NET_HOME: '/mnt/efs/models',
        NUMBA_CACHE_DIR: '/mnt/efs/cache'
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
  }

  /**
   * Creates the GPU infrastructure for running RunBg on images
   * from the input queue.
   */
  private createGpuImpl() {
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
        containerName: 'rembg-image-processor',
        cpuLimit: 4096,
        memoryLimitMiB: this.props.maxMemorySize ?? DEFAULT_MEMORY_SIZE_GPU,
        gpuCount: 1,
        environment: {
          POWERTOOLS_SERVICE_NAME: description.name,
          SNS_TARGET_TOPIC: this.eventBus.topicArn,
          PROCESSED_FILES_BUCKET: this.storage.id(),
          ALPHA_MATTING: this.props.alphaMatting ? 'true' : 'false',
          ALPHA_MATTING_FG_THRESHOLD: this.props.alphaMattingForegroundThreshold?.toString(),
          ALPHA_MATTING_BG_THRESHOLD: this.props.alphaMattingBackgroundThreshold?.toString(),
          ALPHA_MATTING_EROSION_SIZE: this.props.alphaMattingErosionSize?.toString(),
          MASK_POST_PROCESSING: this.props.maskPostProcessing ? 'true' : 'false',
          U2NET_HOME: '/cache/models',
          NUMBA_CACHE_DIR: '/cache/numba'
        }
      },
      autoScaling: {
        minInstanceCapacity: 0,
        maxInstanceCapacity: this.props.maxInstances,
        maxTaskCapacity: this.props.maxInstances,
        maxMessagesPerTask: 5
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

    return (cluster);
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
      'image/png',
      'image/jpeg'
    ]);
  }

  /**
   * @returns an array of mime-types supported as output
   * type by the data producer.
   */
  supportedOutputTypes(): string[] {
    return ([
      'image/png'
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

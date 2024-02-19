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
  BertExtractiveSummarizerProps,
  BertExtractiveSummarizerPropsSchema
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
  name: 'bert-extractive-summarizer',
  description: 'Provides text summarization using the Bert Extractive Summarizer model.',
  version: '0.3.4',
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
const PROCESSING_TIMEOUT = cdk.Duration.minutes(15);

/**
 * The default memory size to allocate for the CPU compute.
 */
const DEFAULT_MEMORY_SIZE_CPU = 4096;

/**
 * The default memory size to allocate for the GPU compute.
 */
const DEFAULT_MEMORY_SIZE_GPU = 15000;

/**
 * The builder for the `BertExtractiveSummarizer` service.
 */
class BertExtractiveSummarizerBuilder extends MiddlewareBuilder {
  private middlewareProps: Partial<BertExtractiveSummarizerProps> = {};

  /**
   * The maximum amount of instances the
   * cluster can have. Keep this number to
   * a reasonable value to avoid over-provisioning
   * the cluster.
   * @param maxInstances the maximum amount of instances.
   * @default 5
   */
  public withMaxInstances(maxInstances: number) {
    this.middlewareProps.maxInstances = maxInstances;
    return (this);
  }

  /**
   * Sets the summarization ratio to use expressed
   * in percentage between 0.1 and 1.0.
   * @param ratio the summarization ratio to use.
   * @returns the builder instance.
   * @default 0.2
   */
  public withRatio(ratio: number) {
    this.middlewareProps.ratio = ratio;
    return (this);
  }

  /**
   * @returns a new instance of the `BertExtractiveSummarizer`
   * service constructed with the given parameters.
   */
  public build(): BertExtractiveSummarizer {
    const props = BertExtractiveSummarizerPropsSchema.parse({
      ...this.middlewareProps,
      ...this.props
    });

    return (new BertExtractiveSummarizer(
      this.scope,
      this.identifier, {
        ...this.middlewareProps as BertExtractiveSummarizerProps,
        ...props
      }
    ));
  }
}

/**
 * A service providing extractive text summarization
 * using the Bert Extractive Summarizer model.
 * @see https://pypi.org/project/bert-extractive-summarizer/
 */
export class BertExtractiveSummarizer extends Middleware {

  /**
   * The storage containing processed files.
   */
  public storage: CacheStorage;

  /**
   * The data processor lambda function.
   */
  public processor: lambda.IFunction;

  /**
   * The builder for the `BertExtractiveSummarizer` service.
   */
  static Builder = BertExtractiveSummarizerBuilder;

  /**
   * Construct constructor.
   */
  constructor(scope: Construct, id: string, private props: BertExtractiveSummarizerProps) {
    super(scope, id, description, {
      ...props,
      queueVisibilityTimeout: cdk.Duration.seconds(
        6 * PROCESSING_TIMEOUT.toSeconds()
      )
    });

    // Validate the properties.
    this.props = this.parse(BertExtractiveSummarizerPropsSchema, props);

    ///////////////////////////////////////////
    /////////    Processing Storage      //////
    ///////////////////////////////////////////

    this.storage = new CacheStorage(this, 'Storage', {
      encryptionKey: props.kmsKey
    });

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

    // The summarizer function.
    this.processor = new lambda.DockerImageFunction(this, 'Compute', {
      description: 'A function generating summaries using BERT extractive summarization.',
      code: lambda.DockerImageCode.fromImageAsset(
        path.resolve(__dirname, 'lambdas', 'summarizer')
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
        SUMMARIZATION_RATIO: `${this.props.ratio}`,
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
  }

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
        containerName: 'bert-extractive-summarizer',
        cpuLimit: 4096,
        memoryLimitMiB: this.props.maxMemorySize ?? DEFAULT_MEMORY_SIZE_GPU,
        gpuCount: 1,
        environment: {
          POWERTOOLS_SERVICE_NAME: description.name,
          SNS_TARGET_TOPIC: this.eventBus.topicArn,
          PROCESSED_FILES_BUCKET: this.storage.id(),
          SUMMARIZATION_RATIO: `${this.props.ratio}`,
          CACHE_DIR: '/cache',
          HF_HOME: '/cache'
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

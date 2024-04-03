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
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as node from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventTargets from 'aws-cdk-lib/aws-events-targets';

import { Construct } from 'constructs';
import { NAMESPACE } from '@project-lakechain/core/middleware';
import { EcsClusterProps, EcsClusterPropsSchema } from './definitions/props';

/**
 * The ECS cluster pattern aims at making it easy for middlewares
 * to run containerized tasks in a scalable and cost-effective way
 * using a consumer-producer pattern.
 *
 * The pattern uses an SQS queue as the input event source and an
 * SNS topic as the output event bus. The SQS queue is used to
 * buffer the messages to be processed by the tasks, while the
 * SNS topic is used to publish events from the tasks to the next
 * middlewares in the chain.
 *
 * This construct provides an EFS file system mounted on the containers
 * to allow the caching of ML models and temporary files.
 *
 * This construct also provides autoscaling capabilities for scaling
 * the EC2 instances required to run the tasks, as well as the number
 * of consumer tasks.
 */
export class EcsCluster extends Construct {

  /**
   * The task definition.
   */
  public taskDefinition: ecs.TaskDefinition;

  /**
   * The container definition.
   */
  public container: ecs.ContainerDefinition;

  /**
   * The X-Ray sidecar container definition.
   */
  public xraySidecar?: ecs.ContainerDefinition;

  /**
   * The elastic file system associated with
   * the cluster.
   */
  public fileSystem: efs.IFileSystem;

  /**
   * The access point to the elastic file system.
   */
  public accessPoint: efs.AccessPoint;

  /**
   * The event processing lambda function.
   */
  public autoScaler: lambda.IFunction;

  /**
   * The IAM role associated with the containers.
   */
  public taskRole: iam.IRole;

  /**
   * Constructs a new instance of the `EcsCluster` class.
   * @param scope the construct scope.
   * @param id the construct identifier.
   * @param props the construct properties.
   */
  constructor(scope: Construct, id: string, private props: EcsClusterProps) {
    super(scope, id);

    // Validate the properties.
    this.props = EcsClusterPropsSchema.parse(props);

    ///////////////////////////////////////////
    /////////     Security Group     //////////
    ///////////////////////////////////////////

    // The security group used to control access to the
    // ECS cluster.
    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: this.props.vpc
    });

    ///////////////////////////////////////////
    ///////     Elastic File-system     ///////
    ///////////////////////////////////////////

    if (this.props.fileSystem) {
      // The filesystem will contain the temporary files and
      // act as a caching layer.
      this.fileSystem = new efs.FileSystem(this, 'Filesystem', {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        vpc: this.props.vpc,
        throughputMode: efs.ThroughputMode.ELASTIC,
        encrypted: true,
        kmsKey: this.props.kmsKey,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        }
      });

      // Allow services in the VPC to access the EFS.
      this.fileSystem.connections.allowFrom(
        securityGroup,
        ec2.Port.tcp(2049),
        'Provides access to the EFS from the container tasks.'
      );

      if (this.props.fileSystem.accessPoint) {
        // Creating an access point to the EFS which allows specific
        // POSIX users to access the filesystem.
        this.accessPoint = new efs.AccessPoint(this, 'AccessPoint', {
          fileSystem: this.fileSystem,
          path: this.props.fileSystem?.containerPath ?? '/cache',
          createAcl: {
            ownerGid: `${this.props.fileSystem.accessPoint.gid}`,
            ownerUid: `${this.props.fileSystem.accessPoint.uid}`,
            permissions: `${this.props.fileSystem.accessPoint.permission}`
          },
          posixUser: {
            gid: `${this.props.fileSystem.accessPoint.gid}`,
            uid: `${this.props.fileSystem.accessPoint.uid}`
          }
        });
      }
    }
    
    ///////////////////////////////////////////
    //////////      ECS Cluster      //////////
    ///////////////////////////////////////////

    // The ECS cluster running processing jobs.
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: this.props.vpc,
      containerInsights: this.props.containerInsights
    });

    // Creating a launch template that will define the characteristics
    // of the EC2 instances to run within the cluster.
    const launchTemplate = new ec2.LaunchTemplate(this, 'Template', {
      ...this.props.launchTemplateProps,

      // Providing the EC2 instances with the ability to
      // be managed by AWS Systems Manager.
      role: new iam.Role(this, 'InstanceRole', {
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromManagedPolicyArn(this, 'SSMStandard',
            'arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore'
          )
        ]
      }),
      securityGroup,
      instanceMetadataTags: true
    });

    // The task execution role.
    const taskExecutionRole = new iam.Role(this, 'ExecutionRole', {
      managedPolicies: [
        iam.ManagedPolicy.fromManagedPolicyArn(this, 'ECSTaskExecutionRole',
          'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'
        )
      ],
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('ecs.amazonaws.com'),
        new iam.ServicePrincipal('ecs-tasks.amazonaws.com')
      )
    });

    // The task definition for running processing containers.
    this.taskDefinition = new ecs.TaskDefinition(this, 'TaskDefinition', {
      networkMode: ecs.NetworkMode.HOST,
      compatibility: ecs.Compatibility.EC2,
      executionRole: taskExecutionRole
    });
    this.taskRole = this.taskDefinition.taskRole;

    // Allow the tasks to consume messages from the queue
    // and to publish events to the event bus.
    this.props.eventQueue.grantConsumeMessages(this.taskRole);
    this.props.eventBus.grantPublish(this.taskRole);

    // Allow the tasks to write logs to X-Ray.
    this.taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess')
    );

    // Creating the capacity provider to be used by the cluster.
    // The capacity provider uses an autoscaling group allowing
    // to spread containers across a cluster of instances.
    const capacityProvider = new ecs.AsgCapacityProvider(this, 'CapacityProvider', {
      autoScalingGroup: new autoscaling.AutoScalingGroup(this, 'Asg', {
        vpc: this.props.vpc,
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
        },
        minCapacity: this.props.autoScaling.minInstanceCapacity,
        maxCapacity: this.props.autoScaling.maxInstanceCapacity,
        launchTemplate
      })
    });
    cluster.addAsgCapacityProvider(capacityProvider);

    ///////////////////////////////////////////
    ///////   User-Provider Container   ///////
    ///////////////////////////////////////////

    this.container = this.taskDefinition.addContainer(this.props.containerProps.containerName, {
      image: this.props.containerProps.image,
      cpu: this.props.containerProps.cpuLimit,
      memoryLimitMiB: this.props.containerProps.memoryLimitMiB,
      gpuCount: this.props.containerProps.gpuCount,
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: this.props.containerProps.containerName,
        logGroup: this.props.logGroup
      }),
      environment: {
        INPUT_QUEUE_URL: this.props.eventQueue.queueUrl,
        SNS_TARGET_TOPIC: this.props.eventBus.topicArn,
        CACHE_DIR: this.props.fileSystem?.containerPath ?? '/cache',
        AWS_DEFAULT_REGION: cdk.Stack.of(this).region,
        ...this.props.containerProps.environment
      }
    });

    if (this.props.fileSystem) {
      // Mounting the elastic filesystem as a volume
      // for the container.
      this.taskDefinition.addVolume({
        name: 'efs',
        efsVolumeConfiguration: {
          fileSystemId: this.fileSystem.fileSystemId,
          transitEncryption: 'ENABLED',
          authorizationConfig: this.accessPoint && {
            accessPointId: this.accessPoint.accessPointId,
            iam: 'ENABLED'
          }
        }
      });

      // Reference the volume as a mount point.
      this.container.addMountPoints({
        containerPath: this.props.fileSystem?.containerPath ?? '/cache',
        readOnly: this.props.fileSystem?.readonly ?? false,
        sourceVolume: 'efs'
      });
    }

    // If a CMK is specified, we grant additional permissions
    // to the task role and the autoscaling group.
    if (this.props.kmsKey) {
      this.props.kmsKey.grantDecrypt(this.taskRole);
    }

    ///////////////////////////////////////////
    ///////   X-Ray Sidecar Container   ///////
    ///////////////////////////////////////////

    if (this.props.xraySidecar) {
      this.xraySidecar = this.taskDefinition.addContainer('xray', {
        image: ecs.ContainerImage.fromRegistry('amazon/aws-xray-daemon'),
        memoryLimitMiB: 256,
        cpu: 32,
        portMappings: [{
          hostPort: 2000,
          containerPort: 2000,
          protocol: ecs.Protocol.UDP
        }],
        logging: ecs.LogDrivers.awsLogs({
          streamPrefix: 'xray',
          logGroup: this.props.logGroup
        }),
        environment: {
          AWS_REGION: cdk.Stack.of(this).region
        }
      });

      // Reference the X-Ray daemon address as an environment variable
      // to the user-provider container.
      this.container.addEnvironment('AWS_XRAY_DAEMON_ADDRESS', '127.0.0.1:2000');
    }

    ///////////////////////////////////////////
    ////////    ECS Tasks Autoscaler     //////
    ///////////////////////////////////////////

    // The goal of the autoscaler lambda function is to scale the number of
    // tasks in the cluster based on the number of messages
    // visible on the SQS queue.
    //
    // A deliberate choice was made to use a Lambda function
    // to perform the scaling instead of using an ECS service
    // and a CloudWatch alarm in order to reduce the latency
    // in scaling the tasks, while providing more flexibility
    // in deciding how much tasks to schedule.
    //
    // For example, the autoscaler takes into account the number
    // of tasks currently running in the cluster and the number
    // of tasks that are pending to be run, in addition to the
    // number of messages visible on the SQS queue.
    //
    // We also did not want any task to be killed while processing
    // messages by the ECS service auto-scaling service, and each
    // task consumes messages from the queue indefinitely as long
    // as there are visible messages in the queue.
    this.autoScaler = new node.NodejsFunction(this, 'AutoScaler', {
      description: 'Manages auto-scaling of tasks in the ECS cluster.',
      entry: path.resolve(__dirname, 'lambdas', 'ecs-task-autoscaler', 'index.js'),
      runtime: lambda.Runtime.NODEJS_18_X,
      tracing: lambda.Tracing.ACTIVE,
      environmentEncryption: this.props.kmsKey,
      logGroup: this.props.logGroup,
      environment: {
        POWERTOOLS_SERVICE_NAME: this.props.containerProps.containerName,
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        CONTAINER_SQS_QUEUE_URL: this.props.eventQueue.queueUrl,
        ECS_CLUSTER_ARN: cluster.clusterArn,
        ECS_TASK_DEFINITION_ARN: this.taskDefinition.taskDefinitionArn,
        CAPACITY_PROVIDER_NAME: capacityProvider.capacityProviderName,
        MAX_TASK_NUMBER: `${this.props.autoScaling.maxTaskCapacity}`,
        MESSAGES_PER_TASK: `${this.props.autoScaling.maxMessagesPerTask}`
      },
      bundling: {
        minify: true,
        externalModules: [
          '@aws-sdk/client-sqs',
          '@aws-sdk/client-ecs'
        ]
      }
    });

    // Allow the autoscaler function to start new ECS tasks.
    this.taskDefinition.grantRun(this.autoScaler);

    // Allow the autoscaler to read properties from the queue.
    this.props.eventQueue.grant(this.autoScaler, 'sqs:GetQueueAttributes');

    // Allow the autoscaler to retrieve information about tasks
    // running in the cluster. That is, knowing whether a given
    // task is currently running or pending.
    this.autoScaler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ecs:ListTasks',
        'ecs:DescribeTasks'
      ],
      resources: ['*'],
      conditions: {
        ArnEquals: {
          'ecs:cluster': cluster.clusterArn
        }
      }
    }));

    // CloudWatch Event rule to trigger the autoscaler.
    new events.Rule(this, 'PeriodicRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new eventTargets.LambdaFunction(this.autoScaler)]
    });
  }
}

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

import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';

import { z } from 'zod';
import { AutoscalingPropsSchema } from './autoscaling-props';
import { FileSystemPropsSchema } from './filesystem-props';
import { ContainerPropsSchema } from './container-props';

/**
 * ECS cluster properties.
 */
export const EcsClusterPropsSchema = z.object({

  /**
   * The VPC used by the middleware.
   */
  vpc: z.custom<ec2.IVpc>(
    (data) => data instanceof Object,
    { message: 'A VPC is required by the ECS cluster.' }
  ),

  /**
   * The input event queue from which the tasks
   * will be consuming messages.
   */
  eventQueue: z.custom<sqs.IQueue>(
    (data) => data instanceof Object,
    { message: 'The input SQS queue is required by the ECS cluster.' }
  ),

  /**
   * The output event bus to which the tasks
   * will be publishing events.
   */
  eventBus: z.custom<sns.ITopic>(
    (data) => data instanceof Object,
    { message: 'The output SNS event bus is required by the ECS cluster.' }
  ),

  /**
   * The log group to use to store the logs
   * emitted by the construct resources.
   */
  logGroup: z.custom<logs.ILogGroup>(),

  /**
   * A KMS key used to encrypt the underlying EFS storage
   * and AWS CloudWatch log groups associated with the cluster.
   */
  kmsKey: z
    .custom<kms.IKey>()
    .optional(),

  /**
   * The container properties.
   */
  containerProps: ContainerPropsSchema,

  /**
   * The auto-scaling properties.
   */
  autoScaling: AutoscalingPropsSchema,

  /**
   * Optional launch template properties
   * to use.
   */
  launchTemplateProps: z.custom<Partial<ec2.LaunchTemplateProps>>(
    (data) => data instanceof Object
  ),

  /**
   * The file system properties.
   */
  fileSystem: FileSystemPropsSchema
    .default({
      throughputMode: efs.ThroughputMode.ELASTIC,
      containerPath: '/cache',
      readonly: false
    })
    .optional(),

  /**
   * Whether to enable container insights.
   * @default false
   */
  containerInsights: z
    .boolean()
    .optional(),

  /**
   * Whether to enable the xray daemon sidecar.
   * @default false
   */
  xraySidecar: z
    .boolean()
    .default(false)
    .optional()
});

// Export the `EcsClusterProps` type.
export type EcsClusterProps = z.infer<typeof EcsClusterPropsSchema>;
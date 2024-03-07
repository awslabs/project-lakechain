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

import * as ec2 from 'aws-cdk-lib/aws-ec2';

import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';
import { CloudEvent } from '@project-lakechain/sdk';
import { InfrastructureDefinition } from './infrastructure';
import { FfmpegCommand } from 'fluent-ffmpeg';

/**
 * A function expression that executes the FFMPEG evaluation.
 * @param event the cloud event to process.
 * @returns a promise resolving to a boolean value.
 */
export type IntentExpression = (events: CloudEvent[], ffmpeg: FfmpegCommand) => Promise<FfmpegCommand>;

/**
 * The middleware properties.
 */
export const FfmpegProcessorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The VPC used by the middleware.
   */
  vpc: z.custom<ec2.IVpc>(
    (data) => data instanceof ec2.Vpc,
    { message: 'A VPC instance is required by the FFMPEG middleware.' }
  ),

  /**
   * The duration for the Condition.
   * This can be either a `cdk.Duration` to determine a relative Condition,
   * or a `Date` object to determine an absolute time at which the
   * next middlewares in the pipeline will be called.
   * @default true
   */
  intent: z.custom<IntentExpression>(
    (value) => typeof value === 'function',
    { message: 'The FFMPEG intent must be a function.' }
  ),

  /**
   * The infrastructure to run FFMPEG.
   * @default c6a.xlarge
   */
  infrastructure: z
    .custom<InfrastructureDefinition>()
    .optional()
    .default(new InfrastructureDefinition.Builder()
      .withInstanceType(ec2.InstanceType.of(
        ec2.InstanceClass.C6A,
        ec2.InstanceSize.XLARGE
      ))
      .withMaxMemory(7068)
      .withGpus(0)
      .build()
    ),

  /**
   * The maximum number of instances that
   * the cluster can have.
   * @default 5
   */
  maxInstances: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(5)
});

// Export the `FfmpegProcessorProps` type.
export type FfmpegProcessorProps = z.infer<typeof FfmpegProcessorPropsSchema>;

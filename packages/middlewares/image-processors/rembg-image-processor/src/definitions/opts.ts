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

/**
 * Rembg image processor properties schema.
 */
export const RembgImageProcessorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The VPC used by the middleware.
   */
  vpc: z.custom<ec2.IVpc>(
    (data) => data instanceof ec2.Vpc,
    { message: 'A VPC is required by the bert extractive summarizer middleware.' }
  ),

  /**
   * Whether to enable alpha matting.
   * @default false
   */
  alphaMatting: z
    .boolean()
    .optional()
    .default(false),

  /**
   * Foreground threshold for alpha matting.
   * @default 240
   */
  alphaMattingForegroundThreshold: z
    .number()
    .optional()
    .default(240),

  /**
   * Background threshold for alpha matting.
   * @default 10
   */
  alphaMattingBackgroundThreshold: z
    .number()
    .optional()
    .default(10),

  /**
   * Erosion size for alpha matting.
   * @default 10
   */
  alphaMattingErosionSize: z
    .number()
    .optional()
    .default(10),

  /**
   * Whether to enable mask post-processing.
   * @default false
   */
  maskPostProcessing: z
    .boolean()
    .optional()
    .default(false),

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

// The type of the `RembgImageProcessorProps` schema.
export type RembgImageProcessorProps = z.infer<typeof RembgImageProcessorPropsSchema>;

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
import { ClipModel } from './model';

/**
 * The Clip Image Processor properties.
 */
export const ClipImageProcessorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The VPC used by the middleware.
   */
  vpc: z.custom<ec2.IVpc>((value) => {
    return !!(value);
  }, {
    message: 'A VPC is required by the Clip processor.'
  }),

  /**
   * The Clip model to use.
   * @default ClipModel.VIT_B_32
   */
  model: z
    .nativeEnum(ClipModel)
    .optional()
    .default(ClipModel.VIT_B_32),

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
    .default(5),

  /**
   * Whether to extract labels from the images
   * as keywords in the document metadata.
   * @default true
   */
  extractLabels: z
    .boolean()
    .optional()
    .default(true)
});

// Export the `ClipImageProcessorPropsSchema` type.
export type ClipImageProcessorProps = z.infer<typeof ClipImageProcessorPropsSchema>;
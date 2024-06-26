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

import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';

/**
 * The Hashing image processor properties.
 */
export const HashingImageProcessorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * Whether to compute the average hash of images.
   * @default true
   */
  averageHashing: z
    .boolean()
    .default(true),

  /**
   * Whether to compute the perceptual hash of images.
   * @default true
   */
  perceptualHashing: z
    .boolean()
    .default(true),

  /**
   * Whether to compute the difference hash of images.
   * @default true
   */
  differenceHashing: z
    .boolean()
    .default(true),

  /**
   * Whether to compute the wavelet hash of images.
   * @default true
   */
  waveletHashing: z
    .boolean()
    .default(true),

  /**
   * Whether to compute the color hash of images.
   * @default true
   */
  colorHashing: z
    .boolean()
    .default(true)
});

// Export the `HashingImageProcessorProps` type.
export type HashingImageProcessorProps = z.infer<typeof HashingImageProcessorPropsSchema>;

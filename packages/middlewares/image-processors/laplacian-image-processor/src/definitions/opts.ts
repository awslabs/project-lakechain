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
import { Depth } from './depth';

/**
 * The Laplacian image processor properties.
 */
export const LaplacianImageProcessorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The depth level to apply when computing
   * the Laplacian variance.
   * @default Depth.CV_64F
   */
  depth: z
    .nativeEnum(Depth)
    .default(Depth.CV_64F),

  /**
   * The kernel size to apply when computing
   * the Laplacian variance.
   * @default 3
   */
  kernelSize: z
    .number()
    .default(3)
});

// Export the `LaplacianImageProcessorProps` type.
export type LaplacianImageProcessorProps = z.infer<typeof LaplacianImageProcessorPropsSchema>;

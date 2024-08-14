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
 * The Canny edge detector properties.
 */
export const CannyEdgeDetectorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The lower threshold of the hysteresis procedure.
   * Edges with intensity gradients below this value will be discarded.
   * @default 100
   */
  lowerThreshold: z
    .number()
    .default(100),

  /**
   * The upper threshold of the hysteresis procedure.
   * Edges with intensity gradients above this value will be considered strong edges.
   * @default 200
   */
  upperThreshold: z
    .number()
    .default(200),

  /**
   * The size of the Sobel kernel used for edge detection.
   * This parameter affects the level of detail in the edges detected.
   * @default 3
   */
  apertureSize: z
    .union([z.literal(3), z.literal(5), z.literal(7)])
    .default(3),

  /**
   * Specifies the equation for finding gradient magnitude.
   * @default false
   */
  l2Gradient: z
    .boolean()
    .default(false),
});

// Export the `CannyEdgeDetectorProps` type.
export type CannyEdgeDetectorProps = z.infer<typeof CannyEdgeDetectorPropsSchema>;

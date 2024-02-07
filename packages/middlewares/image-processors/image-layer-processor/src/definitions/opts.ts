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
import { LayerOperation } from '.';

/**
 * The Image Layer Processor properties.
 */
export const ImageLayerProcessorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * Whether to override metadata from previous
   * middlewares in the pipeline.
   * @default true
   */
  layers: z.array(z.custom<LayerOperation>((value) => {
    return (value instanceof Object);
  }, {
    message: 'At least one layer operation is required by the image layer processor.'
  })).min(1)
});

// Export the `ImageLayerProcessorProps` type.
export type ImageLayerProcessorProps = z.infer<typeof ImageLayerProcessorPropsSchema>;

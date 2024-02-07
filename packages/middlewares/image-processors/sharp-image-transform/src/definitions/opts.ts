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
import { SharpOperations } from '.';

/**
 * The properties for the Sharp image transform middleware.
 */
export const SharpImageTransformSchema = MiddlewarePropsSchema.extend({

  /**
   * The transformations to perform on the image.
   */
  sharpTransforms: z.custom<SharpOperations>((value) => {
    return (value instanceof SharpOperations);
  }, {
    message: 'A transform expression is required by the Sharp middleware.'
  })
});

// Properties type for the `SharpImageTransform` middleware.
export type SharpImageTransformProps = z.infer<typeof SharpImageTransformSchema>;
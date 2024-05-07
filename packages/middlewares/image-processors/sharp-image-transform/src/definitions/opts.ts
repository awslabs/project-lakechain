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

import sharp from 'sharp';
import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';
import { SharpOperations } from '.';
import { CloudEvent } from '@project-lakechain/sdk';

declare function Sharp(options?: sharp.SharpOptions): sharp.Sharp;
declare function Sharp(
  input?:
      | Buffer
      | ArrayBuffer
      | Uint8Array
      | Uint8ClampedArray
      | Int8Array
      | Uint16Array
      | Int16Array
      | Uint32Array
      | Int32Array
      | Float32Array
      | Float64Array
      | string,
  options?: sharp.SharpOptions,
): sharp.Sharp;

export type SharpFunction = typeof Sharp;

export type SharpObject = sharp.Sharp;

/**
 * A function expression that executes the Sharp funclet evaluation.
 * @param event the cloud event to process.
 * @param sharp the sharp instance to apply the transformations to.
 * @returns a promise resolving to a boolean value.
 */
export type IntentExpression = (
  event: CloudEvent,
  sharp: SharpFunction
) => AsyncGenerator<any, void, sharp.Sharp>;

/**
 * The properties for the Sharp image transform middleware.
 */
export const SharpImageTransformSchema = MiddlewarePropsSchema.extend({

  /**
   * The transformations to perform on the image.
   */
  sharpTransforms: z.union([
    z.custom<SharpOperations>((value) => {
      return (value instanceof SharpOperations);
    }, {
      message: 'A transform expression is required by the Sharp middleware.'
    }),
    z.custom<IntentExpression>((value) => {
      return (typeof value === 'function');
    }, {
      message: 'A transform expression is required by the Sharp middleware.'
    })
  ])
});

// Properties type for the `SharpImageTransform` middleware.
export type SharpImageTransformProps = z.infer<typeof SharpImageTransformSchema>;
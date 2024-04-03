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

import * as dsl from '@project-lakechain/core/dsl';
import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';
import { SdxlImageModel } from './image-model.js';

/**
 * Properties which can be passed to the image model.
 */
export const ModelParametersSchema = z.object({

  /**
   * The guidance scale controls the potential for randomness in the image.
   * Numbers that are too high will create a ‘fried’ effect in the image, while
   * numbers that are too low will cause the image to lose coherence.
   * It is recommended that a number between 5 and 15 be used.
   * The default 7 is usually effective for most uses.
   * @min 0
   * @max 30
   */
  cfg_scale: z
    .number()
    .min(0)
    .max(30)
    .optional(),

  /**
   * This parameter allows a user to create images more deterministically.
   * The seed guides the image. Using the same seed as a previous image without
   * changing other parameters will guide the image to reproduce the same image.
   * It is recommended that the seed be set to “0” to randomize the seed every time.
   * This advanced parameter can be leveraged to help users quickly generate desired
   * outputs with pure text-to-image, i.e., without needing to use image-to-image.
   */
  seed: z
    .number()
    .optional(),

  /**
   * Generation step determines how many times the image is sampled.
   * More steps can result in a more accurate result.
   * @min 10
   * @max 150
   */
  steps: z
    .number()
    .min(10)
    .max(150)
    .optional(),

  /**
   * This parameter allows users to leverage different sampling methods that guide
   * the denoising process in generating an image.
   */
  sampler: z
    .string()
    .optional(),

  /**
   * Specifies an initial image to use for the generation.
   */
  init_image: z
    .custom<dsl.IReference<any>>()
    .optional(),

  /**
   * Specifies a mask image to use for inpainting generation.
   */
  mask_image: z
    .custom<dsl.IReference<any>>()
    .optional(),

  /**
   * Specifies a style image to use for generating images.
   */
  style_preset: z
    .string()
    .optional()

}).passthrough();

// Export the `ModelParameters` type.
export type ModelParameters = z.infer<typeof ModelParametersSchema>;

/**
 * SDXL image generator properties schema.
 */
export const SdxlImageGeneratorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The image model to use.
   * @default SdxlImageModel.STABILITY_DIFFUSION_XL_V1
   */
  imageModel: z
    .instanceof(SdxlImageModel)
    .default(SdxlImageModel.STABILITY_DIFFUSION_XL_V1),

  /**
   * The parameters to pass to the image model.
   * @default {}
   */
  modelParameters: ModelParametersSchema
    .default({}),

  /**
   * The prompt to use for generating images.
   */
  prompt: z.custom<dsl.IReference<any>>(
    (value) => !!value,
    { message: 'A prompt is required by the SDXL middleware.' }
  ),

  /**
   * The negative prompts to use when generating images.
   * @default []
   */
  negativePrompts: z
    .array(z.custom<dsl.IReference<any>>())
    .default([]),

  /**
   * The AWS region in which the model will
   * be invoked.
   */
  region: z
    .string()
    .optional()
});

// The type of the `SdxlImageGeneratorProps` schema.
export type SdxlImageGeneratorProps = z.infer<typeof SdxlImageGeneratorPropsSchema>;

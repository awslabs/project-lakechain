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

import { MiddlewarePropsSchema } from '@project-lakechain/core';
import { z } from 'zod';
import { Model } from './model';

/**
 * Properties which can be passed to the text model.
 */
export const ModelParametersSchema = z.object({

  /**
   * Large language models use probability to construct the words in a sequence.
   * For any given sequence, there is a probability distribution of options for
   * the next word in the sequence.
   * When you set the temperature closer to zero, the model tends to select the
   * higher-probability words.
   * When you set the temperature further away from zero,
   * the model may select a lower-probability word.
   * @min 0
   * @max 1
   */
  temperature: z
    .number()
    .min(0)
    .max(1)
    .optional(),

  /**
   * Top P defines a cut off based on the sum of probabilities of the potential choices.
   * If you set Top P below 1.0, the model considers the most probable options and
   * ignores less probable ones.
   * Top P is similar to Top K, but instead of capping the number of choices,
   * it caps choices based on the sum of their probabilities.
   * @min 0
   * @max 1
   */
  topP: z
    .number()
    .min(0)
    .max(1)
    .optional(),

  /**
   * Specifies the maximum number of tokens to use in the generated response.
   * @min 0
   * @max 4096
   */
  maxTokens: z
    .number()
    .min(1)
    .max(4096)
    .optional()
});

// Export the `ModelParameters` type.
export type ModelParameters = z.infer<typeof ModelParametersSchema>;

/**
 * Structured entity extractor properties.
 */
export const StructuredEntityExtractorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The AWS region in which the model will
   * be invoked.
   */
  region: z
    .string()
    .optional(),

  /**
   * The schema to use to extract structured
   * entities from documents.
   */
  schema: z.custom<z.ZodSchema<any>>(
    (schema) => schema,
    { message: 'A schema is required to extract structured entities.' }
  ),

  /**
   * The output type of the structured entities.
   * @default 'json'
   */
  outputType: z
    .enum(['json', 'metadata'])
    .default('json'),

  /**
   * The model to use for structured entity extraction.
   * @default 'anthropic.claude-3-sonnet-20240229-v1:0'
   */
  model: z
    .custom<Model>()
    .default('anthropic.claude-3-sonnet-20240229-v1:0'),
  
  /**
   * Optional instruction to pass to the model to guide it
   * in extracting structured entities.
   */
  instructions: z
    .string()
    .optional(),

  /**
   * The parameters to pass to the text model.
   * @default { maxTokens: 4096, temperature: 0 }
   */
  modelParameters: ModelParametersSchema
    .default({
      maxTokens: 4096,
      temperature: 0
    })
});

// The type of the `StructuredEntityExtractorProps` schema.
export type StructuredEntityExtractorProps = z.infer<typeof StructuredEntityExtractorPropsSchema>;


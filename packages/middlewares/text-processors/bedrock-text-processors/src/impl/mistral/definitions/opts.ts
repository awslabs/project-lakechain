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
import { MistralTextModel } from './model';
import { TextProcessorPropsSchema } from '../../shared/opts';

/**
 * Properties which can be passed to the text model.
 */
export const ModelParametersSchema = z.object({

  /**
   * Controls the randomness of predictions made by the model.
   * @min 0
   * @max 1
   */
  temperature: z
    .number()
    .min(0)
    .max(1)
    .optional(),

  /**
   * Controls the number of most-likely candidates that the model considers for the next token.
   * @min 0
   * @max 200
   */
  top_k: z
    .number()
    .min(0)
    .max(200)
    .optional(),

  /**
   * Controls the diversity of text that the model generates by setting the percentage of
   * most-likely candidates that the model considers for the next token. 
   * @min 0
   * @max 1
   */
  top_p: z
    .number()
    .min(0)
    .max(1)
    .optional(),

  /**
   * Specifies the maximum number of tokens to use in the generated response.
   * @min 0
   * @max 8192
   */
  max_tokens: z
    .number()
    .min(1)
    .max(8192)

}).passthrough();

// Export the `ModelParameters` type.
export type ModelParameters = z.infer<typeof ModelParametersSchema>;

/**
 * Mistral text processor properties schema.
 */
export const MistralTextProcessorPropsSchema = TextProcessorPropsSchema.extend({

  /**
   * The text model to use.
   */
  model: z.instanceof(MistralTextModel),

  /**
   * The parameters to pass to the text model.
   * @default {}
   */
  modelParameters: ModelParametersSchema
    .default({
      max_tokens: 4096
    }),

  /**
   * The system prompt to use for generating text.
   */
  systemPrompt: z
    .string()
    .optional(),

  /**
   * The prompt to use for generating text.
   */
  prompt: z.custom<dsl.IReference<
    dsl.IReferenceSubject
  >>(),

  /**
   * The assistant prefill to use for generating text.
   */
  assistantPrefill: z
    .string()
    .optional()
    .default('')
});

// The type of the `MistralTextProcessorProps` schema.
export type MistralTextProcessorProps = z.infer<typeof MistralTextProcessorPropsSchema>;

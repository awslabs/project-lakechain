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
import { AnthropicTextModel } from './model';
import { TextProcessorPropsSchema } from '../../shared/opts';

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
   * Specifies the number of token choices the model uses to generate the next token.
   * @min 0
   * @max 100_000_000
   */
  top_k: z
    .number()
    .min(0)
    .max(100_000_000)
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
  top_p: z
    .number()
    .min(0)
    .max(1)
    .optional(),

  /**
   * Specifies the maximum number of tokens to use in the generated response.
   * @min 0
   * @max 4096
   */
  max_tokens: z
    .number()
    .min(1)
    .max(4096)

}).passthrough();

// Export the `ModelParameters` type.
export type ModelParameters = z.infer<typeof ModelParametersSchema>;

/**
 * Anthropic text processor properties schema.
 */
export const AnthropicTextProcessorPropsSchema = TextProcessorPropsSchema.extend({

  /**
   * The text model to use.
   */
  model: z.instanceof(AnthropicTextModel),

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
  >>()
});

// The type of the `AnthropicTextProcessorProps` schema.
export type AnthropicTextProcessorProps = z.infer<typeof AnthropicTextProcessorPropsSchema>;

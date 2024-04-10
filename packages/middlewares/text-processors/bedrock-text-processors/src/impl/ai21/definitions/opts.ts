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
import { AI21TextModel } from './model';
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
   */
  topP: z
    .number()
    .min(0)
    .max(1)
    .optional(),

  /**
   * Specifies the maximum number of tokens to use in the generated response.
   */
  maxTokens: z
    .number()
    .min(1)
    .max(8191)
    .optional(),

  /**
   * Use a higher value to lower the probability of generating new tokens that already
   * appear at least once in the prompt or in the completion.
   */
  presencePenalty: z
    .object({
      scale: z
        .number()
        .min(0)
        .max(5)
        .optional(),
      applyToWhitespaces: z
        .boolean()
        .optional(),
      applyToPunctuations: z
        .boolean()
        .optional(),
      applyToNumbers: z
        .boolean()
        .optional(),
      applyToStopwords: z
        .boolean()
        .optional(),
      applyToEmojis: z
        .boolean()
        .optional()
    }).optional(),

  /**
   * Use a higher value to lower the probability of generating new tokens that already
   * appear at least once in the prompt or in the completion.
   * Proportional to the number of appearances.
   */
  countPenalty: z
    .object({
      scale: z
        .number()
        .min(0)
        .max(1)
        .optional(),
      applyToWhitespaces: z
        .boolean()
        .optional(),
      applyToPunctuations: z
        .boolean()
        .optional(),
      applyToNumbers: z
        .boolean()
        .optional(),
      applyToStopwords: z
        .boolean()
        .optional(),
      applyToEmojis: z
        .boolean()
        .optional()
    }).optional(),

  /**
   * Use a high value to lower the probability of generating new tokens that already appear at least
   * once in the prompt or in the completion.
   * The value is proportional to the frequency of the token appearances (normalized to text length).
   */
  frequencyPenalty: z
    .object({
      scale: z
        .number()
        .min(0)
        .max(500)
        .optional(),
      applyToWhitespaces: z
        .boolean()
        .optional(),
      applyToPunctuations: z
        .boolean()
        .optional(),
      applyToNumbers: z
        .boolean()
        .optional(),
      applyToStopwords: z
        .boolean()
        .optional(),
      applyToEmojis: z
        .boolean()
        .optional()
    }).optional()

}).passthrough();

// Export the `ModelParameters` type.
export type ModelParameters = z.infer<typeof ModelParametersSchema>;

/**
 * AI21 text processor properties schema.
 */
export const AI21TextProcessorPropsSchema = TextProcessorPropsSchema.extend({

  /**
   * The text model to use.
   */
  model: z.instanceof(AI21TextModel),

  /**
   * The parameters to pass to the text model.
   * @default {}
   */
  modelParameters: ModelParametersSchema
    .default({}),

  /**
   * The prompt to use for generating text.
   */
  prompt: z.custom<dsl.IReference<
    dsl.IReferenceSubject
  >>()
});

// The type of the `AI21TextProcessorProps` schema.
export type AI21TextProcessorProps = z.infer<typeof AI21TextProcessorPropsSchema>;

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
import { Formality } from './formality';
import { TranslateLanguage } from './language-code';

/**
 * The Translate Text Processor properties.
 */
export const TranslateTextProcessorSchema = MiddlewarePropsSchema.extend({

  /**
   * The output languages in which the translations
   * should be produced.
   */
  outputLanguages: z
    .array(z.custom<TranslateLanguage>())
    .min(1),

  /**
   * Whether to mask profane words in the
   * translation results.
   */
  profanityRedaction: z
    .boolean()
    .default(false),

  /**
   * The formality tone to use in the
   * translation results.
   */
  formality: z
    .nativeEnum(Formality)
    .optional()
});

// Export the `TranslateTextProcessorProps` type.
export type TranslateTextProcessorProps = z.infer<typeof TranslateTextProcessorSchema>;

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
import { VoiceDescriptor } from './voice-descriptor';
import { PollyLanguage } from './language';

/**
 * The Polly Synthesizer properties.
 */
export const PollySynthesizerSchema = MiddlewarePropsSchema.extend({

  /**
   * An optional override for the language to assume
   * the source document being written in.
   * @see https://docs.aws.amazon.com/polly/latest/dg/SupportedLanguage.html
   */
  languageOverride: z
    .custom<PollyLanguage>()
    .optional(),

  /**
   * An optional mapping between a language and a voice descriptor.
   * @see https://docs.aws.amazon.com/polly/latest/dg/voicelist.html
   */
  voiceMapping: z
    .record(z.custom<PollyLanguage>(), z.custom<VoiceDescriptor[]>())
    .optional()
});

// Export the `PollySynthesizerProps` type.
export type PollySynthesizerProps = z.infer<typeof PollySynthesizerSchema>;

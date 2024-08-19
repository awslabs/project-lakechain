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

import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';
import { ElevenLabs } from 'elevenlabs';
import { ElevenLabsModel } from './model';
import { VoiceSettings } from './voice-settings';

/**
 * ElevenLabs synthesizer properties schema.
 */
export const ElevenLabsSynthesizerPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The API key to use for the ElevenLabs API.
   */
  apiKey: z.custom<secrets.ISecret>((value) => {
    return (value instanceof Object);
  }, {
    message: 'An API Key is required by the ElevenLabs Synthesizer.'
  }),

  /**
   * The ElevenLabs model to use.
   * @default eleven_multilingual_v2
   */
  model: z
    .custom<ElevenLabsModel>()
    .default('eleven_multilingual_v2'),

  /**
   * The voice to use for the synthesis.
   */
  voice: z.string(),

  /**
   * The voice settings to use.
   * @default {}
   */
  voiceSettings: z
    .custom<VoiceSettings>()
    .optional(),

  /**
   * The output format to use.
   * @default mp3_44100_128
   */
  outputFormat: z
    .custom<ElevenLabs.OutputFormat>()
    .default('mp3_44100_128')
});

// The type of the `ElevenLabsSynthesizerPropsSchema` schema.
export type ElevenLabsSynthesizerProps = z.infer<typeof ElevenLabsSynthesizerPropsSchema>;

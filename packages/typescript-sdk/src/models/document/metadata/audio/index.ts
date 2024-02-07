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
import { VectorEmbeddingSchema } from '../attributes/vector-embedding.js';

/**
 * Represents additional metadata associated with
 * an audio document.
 */
export const AudioMetadataSchema = z.object({

  /**
   * The duration of the audio document.
   */
  duration: z
    .number()
    .describe('The duration of the audio document.')
    .optional(),

  /**
   * The codec used to encode the audio document.
   */
  codec: z
    .string()
    .describe('The codec used to encode the audio document.')
    .optional(),

  /**
   * The bitrate of the audio track.
   */
  bitrate: z
    .number()
    .describe('The bitrate of the audio track.')
    .optional(),

  /**
   * The sample rate of the audio track.
   */
  sampleRate: z
    .number()
    .describe('The sample rate of the audio track.')
    .optional(),

  /**
   * The number of channels in the audio track.
   */
  channels: z
    .number()
    .describe('The number of channels in the audio track.')
    .optional(),

  /**
   * The language of the audio track.
   */
  language: z
    .string()
    .describe('The language of the audio track.')
    .optional(),

  /**
   * Whether the audio track is lossless.
   */
  lossless: z
    .boolean()
    .describe('Whether the audio track is lossless.')
    .optional(),

  /**
   * The vector embeddings associated with the image document.
   */
  embeddings: VectorEmbeddingSchema
    .describe('The vector embeddings associated with the image document.')
    .optional(),

  /**
   * User defined metadata associated with the audio track.
   */
  custom: z
    .record(z.any())
    .describe('User defined metadata associated with the audio track.')
    .optional()
});

export type AudioMetadata = z.infer<typeof AudioMetadataSchema>;
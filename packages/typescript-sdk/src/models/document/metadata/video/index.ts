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
import { DimensionsSchema } from '../attributes/dimensions.js';
import { AudioMetadataSchema } from '../audio/index.js';
import { VectorEmbeddingSchema } from '../attributes/vector-embedding.js';

/**
 * Represents additional metadata associated with
 * a video document.
 */
export const VideoMetadataSchema = z.object({

  /**
   * The resolution of the video document.
   */
  resolution: DimensionsSchema
    .describe('The resolution of the video document.')
    .optional(),

  /**
   * The format of the video document.
   */
  format: z
    .string()
    .describe('The format of the video document.')
    .optional(),

  /**
   * The duration of the video.
   */
  duration: z
    .number()
    .describe('The duration of the video.')
    .optional(),

  /**
   * The codec used to encode the video document.
   */
  codec: z
    .string()
    .describe('The codec used to encode the video document.')
    .optional(),

  /**
   * The framerate of the video document.
   */
  fps: z
    .number()
    .describe('The framerate of the video document.')
    .optional(),

  /**
   * A URL to a thumbnail of the video document.
   */
  thumbnail: z
    .string()
    .url()
    .describe('A URL to a thumbnail of the video document.')
    .optional(),

  /**
   * The aspect ratio of the video.
   */
  aspectRatio: z
    .number()
    .describe('The aspect ratio of the video.')
    .optional(),

  /**
   * A list of audio tracks in the video.
   */
  audioTracks: z
    .array(AudioMetadataSchema)
    .describe('A list of audio tracks in the video.')
    .optional(),

  /**
   * The vector embeddings associated with the image document.
   */
  embeddings: VectorEmbeddingSchema
    .describe('The vector embeddings associated with the image document.')
    .optional(),

  /**
   * User-defined metadata associated with the video.
   */
  custom: z
    .record(z.any())
    .describe('User-defined metadata associated with the video.')
    .optional()
});

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

export * from '../attributes/dimensions.js';
export * from '../audio/index.js';

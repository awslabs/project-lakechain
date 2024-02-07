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
import { ImageMetadataSchema } from './image/index.js';
import { TextMetadataSchema } from './text/index.js';
import { VideoMetadataSchema } from './video/index.js';
import { AudioMetadataSchema } from './audio/index.js';

/**
 * Represents additional metadata associated with
 * a `Document`.
 *
 * These metadata are carried along the different middleware
 * services and can be progressively enriched along a middleware chain.
 * They provide additional context to the underlying consumers that will
 * interact with the document.
 */
export const DocumentMetadataSchema = z.object({

  /**
   * A ISO 8601 formatted date string
   * in UTC of when the document was created.
   */
  createdAt: z
    .string()
    .describe('The date and time at which the document was created.')
    .optional(),

  /**
   * A ISO 8601 formatted date string
   * in UTC of when the document was last updated.
   */
  updatedAt: z
    .string()
    .describe('The date and time at which the document was last updated.')
    .optional(),

  /**
   * A URL pointing to the main image representing the
   * document.
   */
  image: z
    .string()
    .url()
    .describe('A URL pointing to the main image representing the document.')
    .optional(),

  /**
   * The name of the author(s) of the document.
   */
  authors: z
    .array(z.string())
    .describe('The name of the author(s) of the document.')
    .optional(),

  /**
   * The title of the document.
   */
  title: z
    .string()
    .describe('The title of the document.')
    .optional(),

  /**
   * A text providing a meaningful description
   * of the document.
   */
  description: z
    .string()
    .describe('A meaningful description of the document.')
    .optional(),

  /**
   * An array of prominent keywords associated
   * with the document.
   */
  keywords: z
    .array(z.string())
    .describe('An array of prominent keywords associated with the document.')
    .optional(),

  /**
   * A rating between 1 and 5 representing the
   * quality of the document.
   */
  rating: z
    .number()
    .min(1)
    .max(5)
    .describe('A rating between 1 and 5 representing the quality of the document.')
    .optional(),

  /**
   * Specialized properties for the document.
   */
  properties: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('image'), attrs: ImageMetadataSchema }),
    z.object({ kind: z.literal('text'), attrs: TextMetadataSchema }),
    z.object({ kind: z.literal('video'), attrs: VideoMetadataSchema }),
    z.object({ kind: z.literal('audio'), attrs: AudioMetadataSchema })
  ]).optional()

}).strict();

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

export * from './attributes';
export * from './image';
export * from './text';
export * from './video';
export * from './audio';
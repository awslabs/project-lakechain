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
import { Sentiment } from './attributes/sentiment.js';
import { PartOfSpeech } from './attributes/pos.js';
import { Pii } from './attributes/pii.js';
import { Entity } from './attributes/entities.js';
import { StatsSchema } from './attributes/text-stats.js';
import { ChunkSchema } from './attributes/chunk.js';
import { PointerBuilder } from '../../../../pointer';
import { VectorEmbeddingSchema } from '../attributes/vector-embedding.js';
import { EncodingSchema } from './attributes/encoding.js';
import { LayoutSchema } from './attributes/layout.js';

/**
 * Represents additional metadata associated with
 * a text document.
 */
export const TextMetadataSchema = z.object({

  /**
   * The language of the text document.
   */
  language: z
    .string()
    .describe('The language of the text document.')
    .optional(),

  /**
   * The number of pages in the text document.
   */
  pages: z
    .number()
    .describe('The number of pages in the text document.')
    .optional(),

  /**
   * The page number associated with the text document.
   */
  page: z
    .number()
    .describe('The page number associated with the text document.')
    .optional(),

  /**
   * The number of chapters in the text document.
   */
  chapters: z
    .number()
    .describe('The number of chapters in the text document.')
    .optional(),

  /**
   * The chapter number associated with the text document.
   */
  chapter: z
    .number()
    .describe('The chapter number associated with the text document.')
    .optional(),

  /**
   * Describes the layout of the document.
   */
  layout: LayoutSchema
    .describe('Describes the layout of the document.')
    .optional(),

  /**
   * The estimated reading time of the text document.
   */
  readingTime: z
    .number()
    .describe('The estimated reading time of the text document.')
    .optional(),

  /**
   * The detected sentiment across the text document.
   */
  sentiment: z
    .nativeEnum(Sentiment)
    .describe('The detected sentiment across the text document.')
    .optional(),

  /**
   * The parts of speech (POS) tags in the text document.
   * @note This property represents a URL that is transformed into
   * a pointer to the array of POS at parse time.
   */
  pos: z
    .string()
    .url()
    .describe('The parts of speech (POS) tags in the text document.')
    .transform((url) => {
      return (new PointerBuilder<Array<PartOfSpeech>>()
        .withUri(url)
        .withClassType(PartOfSpeech)
        .build());
    }).optional(),

  /**
   * The personally identifiable information (PII) entities
   * in the text document.
   * @note This property represents a URL that is transformed into
   * a pointer to the array of PII at parse time.
   */
  pii: z
    .string()
    .url()
    .describe('The personally identifiable information (PII) entities in the text document.')
    .transform((url) => {
      return (new PointerBuilder<Array<Pii>>()
        .withUri(url)
        .withClassType(Pii)
        .build());
    }).optional(),

  /**
   * The entities in the text document.
   * @note This property represents a URL that is transformed into
   * a pointer to the array of entities at parse time.
   */
  entities: z
    .string()
    .url()
    .describe('The detected entities in the text document.')
    .transform((url) => {
      return (new PointerBuilder<Array<Entity>>()
        .withUri(url)
        .withClassType(Entity)
        .build());
    }).optional(),

  /**
   * The vector embeddings associated with the text document.
   */
  embeddings: VectorEmbeddingSchema
    .describe('The vector embeddings associated with the text document.')
    .optional(),

  /**
   * A set of statistics associated with the text document.
   */
  stats: StatsSchema
    .describe('A set of statistics associated with the text document.')
    .optional(),

  /**
   * The chunk information the text document is part of.
   */
  chunk: ChunkSchema
    .describe('The chunk information the text document is part of.')
    .optional(),

  /**
   * The encoding of the text document.
   */
  encoding: EncodingSchema
    .describe('The encoding of the text document.')
    .optional(),

  /**
   * Custom metadata associated with the text document.
   * This is a free form object that can contain any
   * custom metadata.
   */
  custom: z
    .record(z.any())
    .describe('Custom metadata associated with the text document.')
    .optional()
});

export type TextMetadata = z.infer<typeof TextMetadataSchema>;

export * from './attributes';
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

/**
 * Describes that the text is part of a chunk,
 * and provides information about the chunk.
 */
export const ChunkSchema = z.object({

  /**
   * The unique identifier of the chunk.
   */
  id: z
    .string()
    .describe('The unique identifier of the chunk.'),

  /**
   * The order of the chunk in the text.
   */
  order: z
    .number()
    .describe('The order of the chunk in the text.'),

  /**
   * The total number of chunks in the text.
   */
  total: z
    .number()
    .optional()
    .describe('The total number of chunks in the text.'),

  /**
   * The start offset of the chunk in the text.
   */
  startOffset: z
    .number()
    .optional()
    .describe('The start offset of the chunk in the text.'),
  
  /**
   * The end offset of the chunk in the text.
   */
  endOffset: z
    .number()
    .optional()
    .describe('The end offset of the chunk in the text.'),
});

export type Chunk = z.infer<typeof ChunkSchema>;

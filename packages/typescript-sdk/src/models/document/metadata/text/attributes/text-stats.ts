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
 * Statistics about a text document.
 */
export const StatsSchema = z.object({

  /**
   * The number of words in the document.
   */
  words: z.number().optional(),

  /**
   * The number of sentences in the document.
   */
  sentences: z.number().optional(),

  /**
   * The number of detected PIIs in the document.
   */
  piis: z.number().optional(),

  /**
   * The number of detected entities in the document.
   */
  entities: z.number().optional(),

  /**
   * The number of detected parts of speech in the document.
   */
  pos: z.number().optional()
});

export type Stats = z.infer<typeof StatsSchema>;

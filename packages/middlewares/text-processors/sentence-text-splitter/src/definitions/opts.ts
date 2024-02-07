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

/**
 * The middleware properties.
 */
export const SentenceTextSplitterPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The maximum number of bytes to chunk the text into.
   * @min 1
   * @default 4000
   */
  maxBytesLength: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(4000)
});

// The type of the `SentenceTextSplitterPropsSchema` schema.
export type SentenceTextSplitterProps = z.infer<typeof SentenceTextSplitterPropsSchema>;
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
import {
  ExtractPagesTask,
  ExtractDocumentTask
} from './tasks';

/**
 * The middleware properties schema.
 */
export const PdfProcessorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The task to perform.
   * @default extracts the entire document as text.
   */
  task: z.union([
    z.custom<ExtractPagesTask>(),
    z.custom<ExtractDocumentTask>()
  ])
  .default(new ExtractDocumentTask.Builder()
    .withOutputType('text')
    .build()
  )
});

// The type of the `PdfProcessorProps` schema.
export type PdfProcessorProps = z.infer<typeof PdfProcessorPropsSchema>;

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
import { OutputFormat } from './output-format';

/**
 * The middleware properties.
 */
export const EmailTextProcessorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The output format.
   */
  outputFormat: z
    .custom<OutputFormat>()
    .optional()
    .default('text'),

  /**
   * Whether to include attachments.
   * @default false
   */
  includeAttachments: z
    .boolean()
    .optional()
    .default(false),

  /**
   * Whether to include CID attachments to data URL images.
   * @default false
   */
  includeImageLinks: z
    .boolean()
    .optional()
    .default(false)
});

// The type of the `EmailTextProcessorPropsSchema` schema.
export type EmailTextProcessorProps = z.infer<typeof EmailTextProcessorPropsSchema>;
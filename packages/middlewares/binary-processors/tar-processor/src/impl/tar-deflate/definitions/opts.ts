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
export const TarDeflateProcessorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * Whether to Gzip the tarball.
   * @default true
   */
  gzip: z
    .boolean()
    .optional()
    .default(true),

  /**
   * The compression level to use when creating Zip archives.
   * This is only valid when `gzip` is set to `true`.
   * @default 1
   */
  compressionLevel: z
    .number()
    .optional()
    .default(1)
});

// The type of the `TarDeflateProcessorPropsSchema` schema.
export type TarDeflateProcessorProps = z.infer<typeof TarDeflateProcessorPropsSchema>;
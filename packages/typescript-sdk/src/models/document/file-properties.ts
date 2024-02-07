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

export const FilePropertiesSchema = z.object({

  /**
   * The extension of the file.
   */
  extension: z
    .function()
    .describe('A function returning the file extension.')
    .returns(z.string()),

  /**
   * The file base name.
   */
  basename: z
    .function()
    .describe('A function returning the file base name.')
    .returns(z.string()),

  /**
   * The file path.
   */
  path: z
    .function()
    .describe('A function returning the file path.')
    .returns(z.string()),

  /**
   * The file name without the extension.
   */
  name: z
    .function()
    .describe('A function returning the file name without the extension.')
    .returns(z.string())
});

export type FileProperties = z.infer<typeof FilePropertiesSchema>;

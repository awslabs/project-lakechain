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

export const ImageStatsSchema = z.object({

  /**
   * The number of detected faces in the image.
   */
  faces: z
    .number()
    .describe('The number of detected faces in the image.')
    .optional(),

  /**
   * The number of detected objects in the image.
   */
  objects: z
    .number()
    .describe('The number of detected objects in the image.')
    .optional(),

  /**
   * The number of detected labels in the image.
   */
  labels: z
    .number()
    .describe('The number of detected labels in the image.')
    .optional(),

  /**
   * The number of detected moderations in the image.
   */
  moderations: z
    .number()
    .describe('The number of detected moderations in the image.')
    .optional(),

  /**
   * The number of detected texts in the image.
   */
  text: z
    .number()
    .describe('The number of detected texts in the image.')
    .optional()
});

export type ImageStats = z.infer<typeof ImageStatsSchema>;

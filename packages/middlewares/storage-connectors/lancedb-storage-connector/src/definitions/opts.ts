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
import { S3StorageProvider, EfsStorageProvider } from './storage';

/**
 * LanceDB Storage Connector properties schema.
 */
export const LanceDbStorageConnectorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The storage provider to use.
   */
  storageProvider: z.union([
    z.custom<S3StorageProvider>(),
    z.custom<EfsStorageProvider>()
  ]),

  /**
   * The name of the table in LanceDB.
   * @default lancedb
   */
  tableName: z
    .string()
    .default('lancedb'),

  /**
   * The size of the vector embeddings.
   */
  vectorSize: z.number(),

  /**
   * Whether to include the text associated with the
   * embeddings in LanceDB.
   * @default false
   */
  includeText: z
    .boolean()
    .default(true)
});

// The type of the LanceDbStorageConnectorProps schema.
export type LanceDbStorageConnectorProps = z.infer<typeof LanceDbStorageConnectorPropsSchema>;

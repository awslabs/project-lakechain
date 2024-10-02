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

import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';

/**
 * Qdrant Storage Connector properties schema.
 */
export const QdrantStorageConnectorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The API key to use for the Qdrant API.
   */
  apiKey: z.custom<secrets.ISecret>((value) => {
    return (value instanceof Object);
  }, {
    message: 'An API Key is required by the Qdrant Data Store.'
  }),

  /**
   * The Qdrant collection to use.
   */
  collectionName: z.string(),

  /**
   * The Qdrant URL to use.
   */
  url: z.string().url(),

  /**
   * Whether to store the text associated with the
   * embeddings in Qdrant as payload.
   * @default true
   */
  storeText: z
    .boolean()
    .default(true),

  /**
   * The key to use for the text in the Qdrant payload.
   * @default 'text'
  */
  textKey: z.string().default("text"),

  /**
   * The name of the vector to use.
   * @default '' Uses the default unnamed vector.
   */
  vectorName: z.string().default(''),
});

// The type of the QdrantStorageConnectorProps schema.
export type QdrantStorageConnectorProps = z.infer<typeof QdrantStorageConnectorPropsSchema>;

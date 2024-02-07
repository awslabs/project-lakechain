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
 * Pinecone Storage Connector properties schema.
 */
export const PineconeStorageConnectorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The API key to use for the Pinecone API.
   */
  apiKey: z.custom<secrets.ISecret>((value) => {
    return (value instanceof Object);
  }, {
    message: 'An API Key is required by the Pinecone Data Store.'
  }),

  /**
   * The Pinecone index to use.
   */
  indexName: z.string(),

  /**
   * The Pinecone controller host to use.
   * @default https://api.pinecone.io
   */
  controllerHostUrl: z
    .string()
    .url()
    .default('https://api.pinecone.io'),

  /**
   * The namespace to use.
   */
  namespace: z
    .string()
    .default(''),

  /**
   * Whether to include the text associated with the
   * embeddings in Pinecone.
   * @default true
   */
  includeText: z
    .boolean()
    .default(true)
});

// The type of the PineconeStorageConnectorProps schema.
export type PineconeStorageConnectorProps = z.infer<typeof PineconeStorageConnectorPropsSchema>;

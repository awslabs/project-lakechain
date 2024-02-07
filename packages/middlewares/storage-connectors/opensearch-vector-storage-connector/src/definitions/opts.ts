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

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';
import * as oss from '@project-lakechain/opensearch-collection';

import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';
import { OpenSearchVectorIndexDefinition } from './index';

/**
 * The OpenSearch Vector Storage Connector properties.
 */
export const OpenSearchVectorStorageConnectorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * Describes the OpenSearch endpoint to store the vectors in.
   */
  endpoint: z.custom<opensearch.IDomain | oss.ICollection>(
    (data) => data instanceof opensearch.Domain || data instanceof oss.Collection,
    { message: 'An OpenSearch endpoint is required by the OpenSearch Vector Storage middleware.' }
  ),

  /**
   * The definition of the OpenSearch index in which the data will be stored.
   * @see https://opensearch.org/docs/latest/search-plugins/knn/knn-index#method-definitions
   */
  index: z.custom<OpenSearchVectorIndexDefinition>(
    (data) => data instanceof OpenSearchVectorIndexDefinition,
    { message: 'An OpenSearch index definition is required by the OpenSearch Vector Storage middleware.' }
  ),

  /**
   * The VPC used by the middleware.
   */
  vpc: z.custom<ec2.IVpc>(
    (data) => data instanceof ec2.Vpc,
    { message: 'A VPC is required by the OpenSearch Vector Storage middleware.' }
  ),

  /**
   * Whether to include the document associated with the
   * embeddings in the index.
   * @default true
   */
  includeDocument: z
    .boolean()
    .default(true)
});

// Export the `OpenSearchVectorStorageConnectorProps` type.
export type OpenSearchVectorStorageConnectorProps = z.infer<typeof OpenSearchVectorStorageConnectorPropsSchema>;

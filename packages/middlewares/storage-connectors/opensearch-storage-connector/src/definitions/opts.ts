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
import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';

/**
 * The available index rotation periods.
 */
export enum IndexRotationPeriod {
  NoRotation = 'NoRotation',
  OneHour    = 'OneHour',
  OneDay     = 'OneDay',
  OneWeek    = 'OneWeek',
  OneMonth   = 'OneMonth'
}

/**
 * The OpenSearch Storage Connector properties.
 */
export const OpenSearchStorageConnectorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * Describes the OpenSearch domain to store the data in.
   */
  domain: z.custom<opensearch.Domain>(
    value => !!value,
    { message: 'An OpenSearch domain is required by the OpenSearch Storage middleware.' }
  ),

  /**
   * The name of the index in which the data will be stored.
   */
  index: z.string(),

  /**
   * An optional VPC to use for accessing the OpenSearch domain.
   */
  vpc: z.custom<ec2.IVpc>(
    value => !!value,
    { message: 'The VPC must be an instance of the `ec2.Vpc` class.' }
  ).optional(),

  /**
   * Buffering options for the Firehose delivery
   * stream to OpenSearch.
   * @default { intervalInSeconds: 60, sizeInMBs: 10 }
   */
  bufferingHints: z.object({
    intervalInSeconds: z.number().optional(),
    sizeInMBs: z.number().optional()
  }).default({
    intervalInSeconds: 60,
    sizeInMBs: 10
  }),

  /**
   * The index rotation period to use when storing
   * the data in OpenSearch.
   * @default IndexRotationPeriod.NoRotation
   */
  indexRotationPeriod: z
    .nativeEnum(IndexRotationPeriod)
    .default(IndexRotationPeriod.NoRotation)
});

// Export the `OpenSearchStorageConnectorProps` type.
export type OpenSearchStorageConnectorProps = z.infer<typeof OpenSearchStorageConnectorPropsSchema>;

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

import * as s3 from 'aws-cdk-lib/aws-s3';
import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';

/**
 * The supported S3 storage classes.
 */
export type StorageClass = 'DEEP_ARCHIVE'
  | 'EXPRESS_ONEZONE'
  | 'GLACIER'
  | 'GLACIER_IR'
  | 'INTELLIGENT_TIERING'
  | 'ONEZONE_IA'
  | 'OUTPOSTS'
  | 'REDUCED_REDUNDANCY'
  | 'SNOW'
  | 'STANDARD'
  | 'STANDARD_IA';

/**
 * The S3 Storage Connector middleware properties.
 */
export const S3StorageConnectorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The destination bucket.
   */
  destinationBucket: z.custom<s3.IBucket>(
    (data) => !!data,
    { message: 'A destination bucket is required by the S3 Storage Connector middleware.' }
  ),

  /**
   * Whether to copy the documents to the destination
   * bucket. If set to false, only the document metadata
   * will be copied.
   * @default true
   */
  copyDocuments: z
    .boolean()
    .default(true),

  /**
   * The storage class to use for storing documents
   * in the destination bucket.
   * @default STANDARD
   */
  storageClass: z
    .custom<StorageClass>()
    .optional()
    .default('STANDARD')
});

// Export the `S3StorageConnectorProps` type.
export type S3StorageConnectorProps = z.infer<typeof S3StorageConnectorPropsSchema>;

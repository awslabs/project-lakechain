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
import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';
import { SummarizationTransformersModel } from './model';

/**
 * Transformers text summarizer properties schema.
 */
export const TransformersTextSummarizerPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The VPC used by the middleware.
   */
  vpc: z.custom<ec2.IVpc>(
    (data) => data instanceof ec2.Vpc,
    { message: 'A VPC is required by the transformers text summarizer middleware.' }
  ),

  /**
   * The embedding model to use.
   */
  model: z
    .instanceof(SummarizationTransformersModel)
    .optional()
    .default(SummarizationTransformersModel.BART_LARGE_CNN),

  /**
   * The maximum size in bytes of each text chunk
   * in which the text will be split.
   * @default 4000
   */
  chunkSize: z
    .number()
    .int()
    .default(4000),

  /**
   * The maximum size in bytes of a summarized chunk.
   * @default 1024
   */
  summarizedChunkSize: z
    .number()
    .int()
    .default(1024)
});

// The type of the `TransformersTextSummarizerProps` schema.
export type TransformersTextSummarizerProps = z.infer<typeof TransformersTextSummarizerPropsSchema>;

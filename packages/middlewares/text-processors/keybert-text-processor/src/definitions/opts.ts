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
import { KeybertEmbeddingModel } from './embedding-model';

/**
 * KeyBERT Text Processor properties schema.
 */
export const KeybertTextProcessorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The VPC used by the middleware.
   */
  vpc: z.custom<ec2.IVpc>(
    (data) => data instanceof ec2.Vpc,
    { message: 'A VPC is required by the KeyBERT Text Processor middleware.' }
  ),

  /**
   * The maximum number of keywords to extract.
   * @default 5
   */
  topN: z
    .number()
    .default(5),

  /**
   * Whether to use the max sum algorithm.
   * @default false
   */
  useMaxSum: z
    .boolean()
    .default(false),

  /**
   * The diversity of the results between 0 and 1.
   * @default 0.5
   */
  diversity: z
    .number()
    .default(0.5),

  /**
   * The number of candidates to consider if `useMaxSum` is
   * set to `true`.
   * @default 20
   */
  candidates: z
    .number()
    .default(20),

  /**
   * The embedding model to be used by KeyBERT.
   * @default ALL_MINI_LM_L6_V2
   */
  embeddingModel: z
    .instanceof(KeybertEmbeddingModel)
    .default(KeybertEmbeddingModel.ALL_MINI_LM_L6_V2)
});

// The type of the `KeybertTextProcessorPropsSchema` schema.
export type KeybertTextProcessorProps = z.infer<typeof KeybertTextProcessorPropsSchema>;

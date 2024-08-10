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
import { TitanEmbeddingModel } from './embedding-model';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';

/**
 * Bedrock Embedding properties schema.
 */
export const BedrockEmbeddingPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The embedding model to use.
   */
  model: z
    .custom<TitanEmbeddingModel>()
    .default(TitanEmbeddingModel.AMAZON_TITAN_EMBED_TEXT_V2),

  /**
   * The AWS region in which the model will
   * be invoked.
   */
  region: z
    .string()
    .optional(),

  /**
   * The size of the embedding to generate.
   * @note this is only valid for multimodal models.
   */
  embeddingSize: z
    .union([
      z.literal(256),
      z.literal(512),
      z.literal(1024)
    ])
    .optional()
});

// The type of the BedrockEmbeddingProps schema.
export type BedrockEmbeddingProps = z.infer<typeof BedrockEmbeddingPropsSchema>;

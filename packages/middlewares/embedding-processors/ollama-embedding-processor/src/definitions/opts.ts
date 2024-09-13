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
import { OllamaEmbeddingModel } from './model';
import { InfrastructureDefinition } from './infrastructure';

/**
 * The middleware properties.
 */
export const OllamaEmbeddingProcessorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The VPC used by the middleware.
   */
  vpc: z.custom<ec2.IVpc>(
    (data) => !!data,
    { message: 'A VPC instance is required by the Ollama embedding middleware.' }
  ),

  /**
   * The identifier of the ollama model to use.
   */
  model: z.custom<OllamaEmbeddingModel>(
    (data) => !!data,
    { message: 'A model is required by the Ollama embedding middleware.' }
  ),

  /**
   * The infrastructure to run the ollama model.
   */
  infrastructure: z
    .custom<InfrastructureDefinition>(
      (data: any) => !!data,
      { message: 'The infrastructure definition is required by the Ollama embedding middleware.' }
    ),

  /**
   * The maximum amount of documents to process in a
   * single batch.
   * @min 1
   * @max 10
   * @default 1
   */
  batchSize: z
    .number()
    .int()
    .min(5)
    .max(10)
    .default(1),

  /**
   * The maximum amount of containers to run concurrently
   * to process the documents.
   * @min 1
   * @default 5
   */
  maxConcurrency: z
    .number()
    .int()
    .min(1)
    .default(5)
});

// Export the `OllamaEmbeddingProcessorPropsSchema` type.
export type OllamaEmbeddingProcessorProps = z.infer<typeof OllamaEmbeddingProcessorPropsSchema>;

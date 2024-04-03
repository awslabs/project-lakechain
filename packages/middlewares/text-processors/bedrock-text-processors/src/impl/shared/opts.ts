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
import { OverflowStrategy } from './strategy';

/**
 * Common properties across text processors.
 */
export const TextProcessorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The AWS region in which the model will
   * be invoked.
   */
  region: z
    .string()
    .optional(),

  /**
   * Defines the overflow strategy to use when
   * the generated text exceeds the model context window.
   */
  overflowStrategy: z
    .custom<OverflowStrategy>()
    .default('passthrough')
});

// The type of the `TextProcessorProps` schema.
export type TextProcessorProps = z.infer<typeof TextProcessorPropsSchema>;

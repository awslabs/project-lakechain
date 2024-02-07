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
import { NlpOperations } from './index';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';
import { Intent } from '@project-lakechain/core/dsl/intent';

/**
 * The middleware properties.
 */
export const NlpTextProcessorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The NLP operations to perform on the text.
   */
  intent: z.custom<Intent>((value) => {
    return (value instanceof NlpOperations);
  }, {
    message: 'An intent is required by the NLP middleware.'
  })
});

// Export the `NlpTextProcessorProps` type.
export type NlpTextProcessorProps = z.infer<typeof NlpTextProcessorPropsSchema>;
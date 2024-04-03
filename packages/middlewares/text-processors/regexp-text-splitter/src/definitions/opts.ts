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

/**
 * The middleware properties.
 */
export const RegexpTextSplitterPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * A string or regular expression to use as
   * a separator between chunks.
   */
  separator: z
    .union([
      z.string(),
      z.custom<RegExp>((value) => {
        if (!(value instanceof RegExp)) {
          throw new Error('Expected a regular expression.');
        }
        return (value);
      }, {
        message: 'The Regexp text splitter expects a valid regular expression.'
      })
    ])
});

// The type of the `RegexpTextSplitterPropsSchema` schema.
export type RegexpTextSplitterProps = z.infer<typeof RegexpTextSplitterPropsSchema>;
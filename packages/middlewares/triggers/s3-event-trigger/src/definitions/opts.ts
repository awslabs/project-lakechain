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
import { MiddlewarePropsSchema } from "@project-lakechain/core/middleware";
import { SourceDescriptor } from './source-descriptor';

/**
 * The S3 event trigger middleware properties.
 */
export const S3EventTriggerPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * Information about the source buckets.
   */
  buckets: z
    .array(z.custom<SourceDescriptor>(
      (data) => data instanceof Object
    ))
    .nonempty()
});

// Export the `S3EventTriggerProps` type.
export type S3EventTriggerProps = z.infer<typeof S3EventTriggerPropsSchema>;

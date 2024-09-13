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

import * as sqs from 'aws-cdk-lib/aws-sqs';
import { z } from 'zod';
import { MiddlewarePropsSchema } from "@project-lakechain/core/middleware";

/**
 * The SQS event trigger middleware properties.
 */
export const SqsEventTriggerPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * An array of source SQS queues to monitor.
   */
  queues: z
    .array(z.custom<sqs.IQueue>(
      (data) => !!data
    ))
    .nonempty()
});

// Export the `SqsEventTriggerProps` type.
export type SqsEventTriggerProps = z.infer<typeof SqsEventTriggerPropsSchema>;

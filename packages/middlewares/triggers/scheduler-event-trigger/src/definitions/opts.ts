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

import * as scheduler from '@aws-cdk/aws-scheduler-alpha';
import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';

/**
 * The Scheduler event trigger middleware properties.
 */
export const SchedulerEventTriggerPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The schedule expression that triggers the pipeline.
   */
  scheduleExpression: z.custom<scheduler.ScheduleExpression>((value) => {
    return (!!value);
  }, {
    message: 'A schedule expression is expected by the scheduler event trigger.'
  }),

  /**
   * A list of documents to inject in the pipeline.
   * @min 0
   * @max 25
   * @default []
   */
  documents: z
    .array(z.string().url())
    .min(0)
    .max(25)
    .default([])
});

// Export the `SchedulerEventTriggerProps` type.
export type SchedulerEventTriggerProps = z.infer<typeof SchedulerEventTriggerPropsSchema>;

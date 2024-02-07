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

/**
 * Cluster auto-scaling group properties. These properties
 * describe how the tasks in the cluster and the underlying
 * EC2 instances should be scaled.
 */
export const AutoscalingPropsSchema = z.object({

  /**
   * The minimum number of EC2 instances in the fleet to
   * scale down to.
   * @default a value of 0.
   */
  minInstanceCapacity: z
    .number()
    .min(0)
    .optional()
    .default(0),

  /**
   * The maximum number of EC2 instances in the fleet to
   * scale up to.
   * @default a value of 1.
   */
  maxInstanceCapacity: z
    .number()
    .min(1)
    .optional()
    .default(1),

  /**
   * The maximum number of consumer tasks to run concurrently
   * in the cluster.
   * @default a value of 1
   */
  maxTaskCapacity: z
    .number()
    .min(1)
    .optional()
    .default(1),

  /**
   * The maximum number of messages that a single task
   * can process concurrently.
   * @default a value of 1
   */
  maxMessagesPerTask: z
    .number()
    .min(1)
    .optional()
    .default(1)
});

// Export the `AutoScalingProps` type.
export type AutoScalingProps = z.infer<typeof AutoscalingPropsSchema>;
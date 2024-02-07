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

import * as ecs from 'aws-cdk-lib/aws-ecs';
import { z } from 'zod';

/**
 * Container properties.
 */
export const ContainerPropsSchema = z.object({

  /**
   * The container image to provision the
   * task with.
   */
  image: z.custom<ecs.ContainerImage>(
    (data) => data instanceof Object,
    { message: 'A container image is required by the ECS cluster.' }
  ),

  /**
   * The name to use for the container.
   * @default container
   */
  containerName: z
    .string()
    .optional()
    .default('container'),

  /**
   * The container CPU limit.
   * @default 4096
   */
  cpuLimit: z.number().default(4096),

  /**
   * The container memory limit.
   * @default 8092
   */
  memoryLimitMiB: z.number().default(8092),

  /**
   * The number of GPUs to allocate to the container.
   * @default 1
   */
  gpuCount: z.number().default(1),

  /**
   * Custom environment variables to pass to the container.
   */
  environment: z.record(z.string()).optional()
});

// Export the `ContainerProps` type.
export type ContainerProps = z.infer<typeof ContainerPropsSchema>;

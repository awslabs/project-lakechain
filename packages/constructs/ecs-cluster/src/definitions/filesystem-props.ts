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

import * as efs from 'aws-cdk-lib/aws-efs';
import { z } from 'zod';

/**
 * Properties for the elastic file system mounted
 * on the tasks.
 */
export const FileSystemPropsSchema = z.object({

  /**
   * The file system throughput mode.
   * @default `ThroughputMode.ELASTIC`
   */
  throughputMode: z
    .nativeEnum(efs.ThroughputMode)
    .default(efs.ThroughputMode.ELASTIC)
    .optional(),

  /**
   * The path in the container where the file system
   * will be mounted.
   * @default /cache
   */
  containerPath: z
    .string()
    .default('/cache')
    .optional(),

  /**
   * Whether the mount point is read only.
   * @default false
   */
  readonly: z
    .boolean()
    .default(false)
    .optional(),

  /**
   * The user to grant access to the filesystem.
   */
  accessPoint: z
    .object({
      uid: z.number(),
      gid: z.number(),
      permission: z.number()
    })
    .optional()
});

// Export the `FileSystemProps` type.
export type FileSystemProps = z.infer<typeof FileSystemPropsSchema>;
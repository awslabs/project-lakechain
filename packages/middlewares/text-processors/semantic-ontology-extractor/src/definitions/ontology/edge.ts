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
 * Schema for an edge property.
 */
export const EdgePropsSchema = z.object({
  
  /**
   * The name of the property.
   */
  name: z.string(),

  /**
   * A description of the property.
   */
  description: z.string(),

  /**
   * The type of the property.
   */
  type: z.string()
});

/**
 * Schema for an edge.
 */
export const EdgeSchema = z.object({

  /**
   * The identifier of the source node.
   */
  source: z.string(),

  /**
   * The identifier of the target node.
   */
  target: z.string(),

  /**
   * The type of the relationship.
   */
  type: z.string(),

  /**
   * A description of the edge.
   */
  description: z.string(),

  /**
   * The properties of the edge.
   */
  props: z
    .array(EdgePropsSchema)
    .optional()
});

export type Edge = z.infer<typeof EdgeSchema>;

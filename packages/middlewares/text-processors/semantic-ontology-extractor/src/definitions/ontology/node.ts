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
 * Schema for a node property.
 */
export const NodePropsSchema = z.object({
  
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
  type: z.string(),

  /**
   * Whether this property is to be considered
   * as a unique identifier for the node instance.
   */
  uniqueIdentifier: z
    .boolean()
    .default(false)
    .optional()
});

/**
 * Represents a node schema description.
 */
export const NodeSchema = z.object({
  
  /**
   * The type of the node.
   */
  type: z.string(),

  /**
   * The description of the node.
   */
  description: z.string(),

  /**
   * Whether this node is connected to the document.
   */
  isHead: z.boolean(),
  
  /**
   * The properties of the node.
   */
  props: z.array(NodePropsSchema)
});

export type Node = z.infer<typeof NodeSchema>;

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
 * Represents an entity extracted from a text document.
 * @example QUANTITY, EVENT, ORGANIZATION, etc.
 */
export const EntitySchema = z.object({
  type: z.string(),
  text: z.string(),
  score: z.number(),
  startOffset: z.number(),
  endOffset: z.number()
});

/**
 * The entity properties.
 */
export type EntityProps = z.infer<typeof EntitySchema>;

/**
 * Represents an entity extracted from a text document.
 * @example QUANTITY, EVENT, ORGANIZATION, etc.
 */
export class Entity {

  /**
   * Pos constructor.
   * @param props the properties of the part of speech.
   */
  constructor(public props: EntityProps) {}

  /**
   * @returns the part of speech tag.
   */
  public static from(data: any) {
    return (new Entity(EntitySchema.parse(data)));
  }

  /**
   * @returns the type of the entity.
   */
  type() {
    return (this.props.type);
  }

  /**
   * @returns the text associated with the
   * entity.
   */
  text() {
    return (this.props.text);
  }

  /**
   * @returns the confidence score associated with the
   * entity detection.
   */
  score() {
    return (this.props.score);
  }

  /**
   * @returns the start offset of the entity.
   */
  startOffset() {
    return (this.props.startOffset);
  }

  /**
   * @returns the end offset of the entity.
   */
  endOffset() {
    return (this.props.endOffset);
  }

  /**
   * @returns a JSON representation of the entity.
   */
  toJSON() {
    return (this.props);
  }
}
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
 * Schema of a label.
 */
export const LabelSchema = z.object({
  name: z.string(),
  confidence: z.number(),
  type: z.string().optional()
});

/**
 * Label properties.
 */
export type LabelProps = z.infer<typeof LabelSchema>;

/**
 * Represents a label detected within an image.
 */
export class Label {

  /**
   * Label constructor.
   * @param props the properties of the label.
   */
  constructor(public props: LabelProps) {}

  /**
   * @returns a new Label object.
   */
  public static from(data: any) {
    return (new Label(LabelSchema.parse(data)));
  }

  /**
   * @returns the name of the label.
   */
  name() {
    return (this.props.name);
  }

  /**
   * @returns the confidence score associated with the
   * label detection.
   */
  confidence() {
    return (this.props.confidence);
  }

  /**
   * @returns the type of the label.
   */
  type() {
    return (this.props.type);
  }

  /**
   * @returns a JSON representation of the label.
   */
  toJSON() {
    return (this.props);
  }
}
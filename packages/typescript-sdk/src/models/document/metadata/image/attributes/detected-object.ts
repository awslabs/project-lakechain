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
import { BoundingBoxSchema } from '../../attributes/bounding-box.js';

/**
 * The schema of a detected object within an image.
 */
export const DetectedObjectSchema = z.object({
  name: z.string().optional(),
  boundingBox: BoundingBoxSchema,
  confidence: z.number()
});

// The detected object properties.
export type DetectedObjectProps = z.infer<typeof DetectedObjectSchema>;

/**
 * Represents a detected object within an image.
 */
export class DetectedObject {

  /**
   * Detected object constructor.
   * @param props the properties of the detected object.
   */
  constructor(public props: DetectedObjectProps) {}

  /**
   * @returns a new detected object.
   */
  public static from(data: any) {
    return (new DetectedObject(DetectedObjectSchema.parse(data)));
  }

  /**
   * @returns the name of the detected object.
   */
  name() {
    return (this.props.name);
  }

  /**
   * @returns the bounding box of the detected object.
   */
  boundingBox() {
    return (this.props.boundingBox);
  }

  /**
   * @returns the confidence score associated with the
   * detected object.
   */
  confidence() {
    return (this.props.confidence);
  }

  /**
   * @returns a JSON representation of the detected object.
   */
  toJSON() {
    return (this.props);
  }
}
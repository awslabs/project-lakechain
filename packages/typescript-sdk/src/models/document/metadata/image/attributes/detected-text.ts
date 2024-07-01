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

export const DetectedTextSchema = z.object({
  text: z.string(),
  boundingBox: BoundingBoxSchema,
  confidence: z.number()
});

// The detected text properties.
export type DetectedTextProps = z.infer<typeof DetectedTextSchema>;

/**
 * Represents a detected text within an image.
 */
export class DetectedText {

  /**
   * Detected text constructor.
   * @param props the properties of the detected text.
   */
  constructor(public props: DetectedTextProps) {}

  /**
   * @returns a new detected text.
   */
  public static from(data: any) {
    return (new DetectedText(DetectedTextSchema.parse(data)));
  }

  /**
   * @returns the text.
   */
  text() {
    return (this.props.text);
  }

  /**
   * @returns the bounding box of the detected text.
   */
  boundingBox() {
    return (this.props.boundingBox);
  }

  /**
   * @returns the confidence score associated with the
   * detected text.
   */
  confidence() {
    return (this.props.confidence);
  }

  /**
   * @returns a JSON representation of the detected text.
   */
  toJSON() {
    return (this.props);
  }
}

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
 * A description of the schema of detected personal
 * protective equipment.
 */
export const DetectionSchema = z.object({
  type: z.string().optional(),
  boundingBox: BoundingBoxSchema
});

export type Detection = z.infer<typeof DetectionSchema>;

/**
 * A description of the detected personal protective equipment
 * associated with a person's body part.
 */
export const BodyPartSchema = z.object({
  name: z.string().optional(),
  confidence: z.number().optional(),
  detections: z.array(DetectionSchema)
});

export type BodyPart = z.infer<typeof BodyPartSchema>;

/**
 * The schema of a person in an image.
 */
export const PersonSchema = z.object({
  wearsRequiredEquipment: z.boolean(),
  bodyParts: z.array(BodyPartSchema),
  boundingBox: BoundingBoxSchema,
  confidence: z.number().optional()
});

// The properties associated with a person.
export type PersonProps = z.infer<typeof PersonSchema>;

/**
 * Represents a person within an image.
 */
export class Person {

  /**
   * Person constructor.
   * @param props the properties of the detected person.
   */
  constructor(public props: PersonProps) {}

  /**
   * @returns a new detected person.
   */
  public static from(data: any) {
    return (new Person(PersonSchema.parse(data)));
  }

  /**
   * @returns whether the person is wearing the required
   * personal protective equipment.
   */
  wearsRequiredEquipment() {
    return (this.props.wearsRequiredEquipment);
  }

  /**
   * @returns the body parts of the person.
   */
  bodyParts() {
    return (this.props.bodyParts);
  }

  /**
   * @returns the bounding box of the detected person.
   */
  boundingBox() {
    return (this.props.boundingBox);
  }

  /**
   * @returns the confidence score associated with the
   * detection of the person.
   */
  confidence() {
    return (this.props.confidence);
  }

  /**
   * @returns a JSON representation of the person.
   */
  toJSON() {
    return (this.props);
  }
}
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
import { BoundingBoxSchema } from './bounding-box.js';
import { LandmarkSchema } from './landmark.js';

/**
 * The pose of a face.
 */
export const PoseSchema = z.object({
  roll: z.number(),
  yaw: z.number(),
  pitch: z.number()
});

export type Pose = z.infer<typeof PoseSchema>;

/**
 * User defined attributes of a face.
 */
export const FaceAttributeSchema = z.object({
  value: z.any().optional(),
  confidence: z.number().optional()
});

export type FaceAttribute = z.infer<typeof FaceAttributeSchema>;

/**
 * Eye direction of a face.
 */
export const EyeDirectionSchema = z.object({
  pitch: z.number(),
  yaw: z.number()
});

export type EyeDirection = z.infer<typeof EyeDirectionSchema>;

/**
 * A description of a face detected in an image
 * with its attributes.
 */
export const FaceSchema = z.object({
  boundingBox: BoundingBoxSchema,
  attributes: z.record(FaceAttributeSchema).optional(),
  landmarks: z.array(LandmarkSchema).optional(),
  pose: PoseSchema.optional(),
  eyeDirection: EyeDirectionSchema.optional(),
  confidence: z.number()
});

// Face properties.
export type FaceProps = z.infer<typeof FaceSchema>;

/**
 * Represents a face detected within an image.
 */
export class Face {

  /**
   * Face constructor.
   * @param props the properties of the Face.
   */
  constructor(public props: FaceProps) {}

  /**
   * @returns a new Face object.
   */
  public static from(data: any) {
    return (new Face(FaceSchema.parse(data)));
  }

  /**
   * @returns the bounding box of the face.
   */
  boundingBox() {
    return (this.props.boundingBox);
  }

  /**
   * @returns the attributes of the face.
   */
  attributes() {
    return (this.props.attributes);
  }

  /**
   * @returns the landmarks of the face.
   */
  landmarks() {
    return (this.props.landmarks);
  }

  /**
   * @returns the pose of the face.
   */
  pose() {
    return (this.props.pose);
  }

  /**
   * @returns the eye direction of the face.
   */
  eyeDirection() {
    return (this.props.eyeDirection);
  }

  /**
   * @returns the confidence score associated with the
   * face detection.
   */
  confidence() {
    return (this.props.confidence);
  }

  /**
   * @returns a JSON representation of the face.
   */
  toJSON() {
    return (this.props);
  }
}
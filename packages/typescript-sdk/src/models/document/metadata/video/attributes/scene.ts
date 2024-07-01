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
 * The schema of a detected scene within an video.
 */
export const SceneSchema = z.object({
  
  /**
   * The index of the scene.
   */
  index: z.number(),

  /**
   * The type of the scene.
   * Can be either `technical-cue` or `shot`.
   */
  type: z.union([
    z.literal('technical-cue'),
    z.literal('shot')
  ]),
  
  /**
   * The timestamp in milliseconds when the scene starts
   * in the video.
   */
  startTime: z.number(),

  /**
   * The timestamp in milliseconds when the scene ends
   * in the video.
   */
  endTime: z.number(),

  /**
   * The duration of the scene in milliseconds.
   */
  duration: z.number(),

  /**
   * The start timecode of the scene.
   * The timecode is in the format `HH:MM:SS:FF`.
   * @optional
   */
  startTimecode: z
    .string()
    .optional(),

  /**
   * The end timecode of the scene.
   * The timecode is in the format `HH:MM:SS:FF`.
   * @optional
   */
  endTimecode: z
    .string()
    .optional(),

  /**
   * The duration timecode of the scene.
   * The timecode is in the format `HH:MM:SS:FF`.
   * @optional
   */
  durationTimecode: z
    .string()
    .optional(),

  /**
   * The index of the first frame of the scene.
   */
  startFrame: z.number(),

  /**
   * The index of the last frame of the scene.
   */
  endFrame: z.number(),

  /**
   * The number of frames in the scene.
   */
  durationFrames: z.number()
});

// The detected scene properties.
export type SceneSchemaProps = z.infer<typeof SceneSchema>;

/**
 * Represents a detected scene within an video.
 */
export class Scene {

  /**
   * Scene constructor.
   * @param props the properties of the scene.
   */
  constructor(public props: SceneSchemaProps) {}

  /**
   * @returns a new scene.
   */
  public static from(data: any) {
    return (new Scene(SceneSchema.parse(data)));
  }

  /**
   * @returns the index of the scene.
   */
  index() {
    return (this.props.index);
  }

  /**
   * @returns the type of the scene.
   */
  type() {
    return (this.props.type);
  }

  /**
   * @returns the start time of the scene in milliseconds.
   */
  startTime() {
    return (this.props.startTime);
  }

  /**
   * @returns the end time of the scene in milliseconds.
   */
  endTime() {
    return (this.props.endTime);
  }

  /**
   * @returns the duration of the scene in milliseconds.
   */
  duration() {
    return (this.props.duration);
  }

  /**
   * @returns the start timecode of the scene.
   */
  startTimecode() {
    return (this.props.startTimecode);
  }

  /**
   * @returns the end timecode of the scene.
   */
  endTimecode() {
    return (this.props.endTimecode);
  }

  /**
   * @returns the duration timecode of the scene.
   */
  durationTimecode() {
    return (this.props.durationTimecode);
  }

  /**
   * @returns the index of the first frame of the scene.
   */
  startFrame() {
    return (this.props.startFrame);
  }

  /**
   * @returns the index of the last frame of the scene.
   */
  endFrame() {
    return (this.props.endFrame);
  }

  /**
   * @returns the number of frames in the scene.
   */
  durationFrames() {
    return (this.props.durationFrames);
  }

  /**
   * @returns a JSON representation of the detected object.
   */
  toJSON() {
    return (this.props);
  }
}

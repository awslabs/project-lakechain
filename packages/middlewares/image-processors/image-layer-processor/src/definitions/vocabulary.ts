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

import { IFilter } from '@project-lakechain/core/dsl/vocabulary/filters';

/**
 * Interface for face detection.
 */
export interface FaceDetection extends IFilter {
  faces: boolean;
}

/**
 * Describes faces as a contextual scope.
 * @returns a face descriptor.
 */
export const faces = (): FaceDetection => ({ faces: true });

/**
 * Interface for object detection.
 */
export interface ObjectDetection extends IFilter {
  objects: boolean;
}

/**
 * Describes objects as a contextual scope.
 * @returns an object descriptor.
 */
export const objects = (): ObjectDetection => ({ objects: true });

/**
 * Interface for text detection.
 */
export interface TextDetection extends IFilter {
  text: boolean;
}

/**
 * Describes text as a contextual scope.
 * @returns a text descriptor.
 */
export const text = (): TextDetection => ({ text: true });

/**
 * Interface for landmarks detection.
 */
export interface LandmarksDetection extends IFilter {
  landmarks: boolean;
}

/**
 * Describes landmarks as a contextual scope.
 * @returns a landmarks descriptor.
 */
export const landmarks = (): LandmarksDetection => ({ landmarks: true });

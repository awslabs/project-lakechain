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

import {
  FaceDetection,
  ObjectDetection,
  TextDetection,
  LandmarksDetection
} from './vocabulary';

export type LayerOperation = { op: string, args: any };

/**
 * Describes a pixelation operation to apply on features
 * of the image.
 * @param args a set of features to pixelate.
 * @returns the current instance.
 */
export const pixelate = (...args: Array<FaceDetection
  | ObjectDetection
  | TextDetection
>): LayerOperation => {
  const opts = {};
  args.forEach((arg: any) => Object.assign(opts, arg));
  return ({ op: 'pixelate', args: opts });
};

/**
 * Describes a highlighting operation to apply on features
 * of the image.
 * @param args a set of features to highlight.
 * @returns the current instance.
 */
export const highlight = (...args: Array<FaceDetection
  | ObjectDetection
  | TextDetection
  | LandmarksDetection
>): LayerOperation => {
  const opts = {};
  args.forEach((arg: any) => Object.assign(opts, arg));
  return ({ op: 'highlight', args: opts });
};

export * from './vocabulary';
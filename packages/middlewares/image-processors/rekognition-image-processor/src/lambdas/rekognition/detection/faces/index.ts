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

import { tracer } from '@project-lakechain/sdk/powertools';
import { Face, FaceAttribute, Landmark } from '@project-lakechain/sdk/models/document/metadata';
import { Attributes, DetectFacesOpts } from './opts.js';
import {
  RekognitionClient,
  DetectFacesCommand,
  FaceDetail
} from '@aws-sdk/client-rekognition';

/**
 * The Rekognition client to use.
 */
const rekognition = tracer.captureAWSv3Client(new RekognitionClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * A filter function to filter out faces that do not match
 * the given attributes.
 * @param attributes a set of attributes to filter faces.
 * @returns a boolean value indicating whether the face
 * matches the given attributes.
 */
const filterAttributes = (attributes: Attributes) => (face: FaceDetail) => {
  // Age attribute filtering.
  if (attributes?.age) {
    const age = face.AgeRange!;
    if (attributes.age.range.lhs > age.Low! || attributes.age.range.rhs < age.High!) {
      return (false);
    }
  }

  // Gender attribute filtering.
  if (attributes?.gender) {
    if (face.Gender!.Value !== attributes.gender) {
      return (false);
    }
  }

  // Smile attribute filtering.
  if (attributes?.smile) {
    if (face.Smile!.Value !== attributes.smile) {
      return (false);
    }
  }

  return (true);
};

/**
 * Exports the detected attributes of the given face
 * into an object.
 * @param face the face to extract attributes from.
 * @returns the extracted attributes.
 */
export const getAttributes = (face: FaceDetail): { [key: string]: FaceAttribute } => ({
  beard: {
    value: face.Beard!.Value!,
    confidence: face.Beard!.Confidence!
  },
  eyeglasses: {
    value: face.Eyeglasses!.Value!,
    confidence: face.Eyeglasses!.Confidence!
  },
  eyesOpen: {
    value: face.EyesOpen!.Value!,
    confidence: face.EyesOpen!.Confidence!
  },
  smile: {
    value: face.Smile!.Value!,
    confidence: face.Smile!.Confidence!
  },
  sunglasses: {
    value: face.Sunglasses!.Value!,
    confidence: face.Sunglasses!.Confidence!
  },
  ageRange: {
    value: face.AgeRange!
  },
  gender: {
    value: face.Gender!.Value!,
    confidence: face.Gender!.Confidence!
  },
  faceOccluded: {
    value: face.FaceOccluded!.Value!,
    confidence: face.FaceOccluded!.Confidence!
  },
  mouthOpen: {
    value: face.MouthOpen!.Value!,
    confidence: face.MouthOpen!.Confidence!
  },
  mustache: {
    value: face.Mustache!.Value!,
    confidence: face.Mustache!.Confidence!
  }
});

/**
 * Exports the detected landmarks of the given face
 * into an array.
 * @param face the face to extract landmarks from.
 * @returns the extracted landmarks.
 */
export const getLandmarks = (face: FaceDetail): Landmark[] => {
  const landmarks: Landmark[] = [];
  if (face.Landmarks) {
    for (const landmark of face.Landmarks) {
      landmarks.push({
        type: landmark.Type!,
        x: landmark.X!,
        y: landmark.Y!
      });
    }
  }
  return (landmarks);
};

/**
 * Exports the detected pose of the given face
 * into an object.
 * @param face the face to extract pose from.
 * @returns the extracted pose.
 */
export const getPose = (face: FaceDetail) => ({
  roll: face.Pose!.Roll!,
  yaw: face.Pose!.Yaw!,
  pitch: face.Pose!.Pitch!
});

/**
 * Starts the face detection operation on the given image.
 * @param url the URL of the image to extract faces from.
 * @param opts the options to use for the detection.
 * @returns the faces detected in the image.
 */
export const detectFaces = async (
  url: URL,
  opts: DetectFacesOpts
): Promise<Face[]> => {
  const res = await rekognition.send(new DetectFacesCommand({
    Image: {
      S3Object: {
        Bucket: decodeURIComponent(url.hostname),
        Name: decodeURIComponent(url.pathname.slice(1))
      }
    },
    Attributes: ['ALL']
  }));

  // Sort by the faces by confidence and filter out
  // faces below the given confidence threshold.
  let filtered = res.FaceDetails
    ?.sort((a, b) => b.Confidence! - a.Confidence!)
    .filter(face => face.Confidence! >= (opts.minConfidence ?? 90));

  // Filter out faces that do not match the given
  // attributes.
  if (opts.attributes) {
    filtered = filtered?.filter(filterAttributes(opts.attributes));
  }

  return (filtered
    ?.slice(0, opts.limit)
    .map(face => Face.from({
      attributes: getAttributes(face),
      landmarks: getLandmarks(face),
      pose: getPose(face),
      confidence: face.Confidence!,
      boundingBox: {
        left: face.BoundingBox?.Left ?? 0,
        top: face.BoundingBox?.Top ?? 0,
        width: face.BoundingBox?.Width ?? 0,
        height: face.BoundingBox?.Height ?? 0
      }
    })) ?? []);
};
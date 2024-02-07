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
import { DetectPpeOpts } from './opts.js';
import { CacheStorage } from '@project-lakechain/sdk/cache';

import {
  BoundingBox,
  PersonalProtectiveEquipment,
  Detection,
  BodyPart,
  Person
} from '@project-lakechain/sdk/models/document/metadata';
import {
  RekognitionClient,
  DetectProtectiveEquipmentCommand,
  BoundingBox as RekognitionBoundingBox,
  ProtectiveEquipmentBodyPart,
  EquipmentDetection
} from '@aws-sdk/client-rekognition';

/**
 * The Rekognition client to use.
 */
const rekognition = tracer.captureAWSv3Client(new RekognitionClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * The cache storage instance.
 */
const cacheStorage = new CacheStorage();

/**
 * Converts a Rekognition bounding box to a bounding box
 * normalized schema.
 * @param boundingBox the bounding box to convert.
 * @returns the converted bounding box.
 */
const asBoundingBox = (boundingBox: RekognitionBoundingBox): BoundingBox => ({
  left: boundingBox.Left!,
  top: boundingBox.Top!,
  width: boundingBox.Width!,
  height: boundingBox.Height!
});

/**
 * Converts a Rekognition detection to a detection
 * normalized schema.
 * @param detection the detection to convert.
 * @returns the converted detection.
 */
const asDetection = (detection: EquipmentDetection): Detection => ({
  type: detection.Type!,
  boundingBox: asBoundingBox(detection.BoundingBox!)
});

/**
 * Converts a Rekognition body part to a body part
 * normalized schema.
 * @param bodyPart the body part to convert.
 * @returns the converted body part.
 */
const asBodyPart = (bodyPart: ProtectiveEquipmentBodyPart): BodyPart => ({
  name: bodyPart.Name!,
  confidence: bodyPart.Confidence!,
  detections: (bodyPart.EquipmentDetections ?? []).map(asDetection)
});

/**
 * Starts a protective equipment detection on the given image.
 * @param url the URL of the image to extract text from.
 * @param opts the options to use for the detection.
 * @returns an array of detected text.
 */
export const detectPpe = async (
  url: URL,
  opts: DetectPpeOpts
): Promise<PersonalProtectiveEquipment> => {
  const res = await rekognition.send(new DetectProtectiveEquipmentCommand({
    Image: {
      S3Object: {
        Bucket: decodeURIComponent(url.hostname),
        Name: decodeURIComponent(url.pathname.slice(1))
      }
    },
    SummarizationAttributes: {
      MinConfidence: opts.minConfidence,
      RequiredEquipmentTypes: opts.requiredEquipment
    }
  }));

  const persons = (res.Persons ?? []).map((person) => Person.from({
    wearsRequiredEquipment: res.Summary?.PersonsWithRequiredEquipment?.includes(person.Id!) ?? false,
    bodyParts: (person.BodyParts ?? []).map(asBodyPart),
    boundingBox: asBoundingBox(person.BoundingBox!),
    confidence: person.Confidence!
  }));

  return ({
    personsWithRequiredEquipment: res.Summary?.PersonsWithRequiredEquipment?.length ?? 0,
    personsWithoutRequiredEquipment: res.Summary?.PersonsWithoutRequiredEquipment?.length ?? 0,
    personsIndeterminate: res.Summary?.PersonsIndeterminate?.length ?? 0,
    persons: await cacheStorage.put('ppe-persons', persons)
  });
};
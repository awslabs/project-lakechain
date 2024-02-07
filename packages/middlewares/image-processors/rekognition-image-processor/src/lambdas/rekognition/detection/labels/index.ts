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
import { DetectLabelsOpts } from './opts.js';
import { DetectedLabelsResponse } from './response.js';
import { Label, DetectedObject } from '@project-lakechain/sdk/models/document/metadata';

import {
  RekognitionClient,
  DetectLabelsCommand,
  DetectModerationLabelsCommand,
  ModerationLabel
} from '@aws-sdk/client-rekognition';

/**
 * The Rekognition client to use.
 */
const rekognition = tracer.captureAWSv3Client(new RekognitionClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * Starts a label detection operation on the given image.
 * @param url the URL of the image to extract metadata from.
 * @param opts the options to use for the detection.
 * @returns the detected labels.
 */
export const detectLabels = async (url: URL, opts: DetectLabelsOpts): Promise<DetectedLabelsResponse> => {
  const labels: Set<Label>         = new Set();
  const objects: DetectedObject[]  = [];
  let moderated: ModerationLabel[] = [];

  // Request Amazon Rekognition to detect the labels
  // in the image.
  const res = await rekognition.send(new DetectLabelsCommand({
    Features: ['GENERAL_LABELS'],
    Image: {
      S3Object: {
        Bucket: decodeURIComponent(url.hostname),
        Name: decodeURIComponent(url.pathname.slice(1))
      }
    },
    Settings: {
      GeneralLabels: {
        LabelCategoryInclusionFilters: opts.categories,
        LabelInclusionFilters: opts.labels
      }
    },
    MaxLabels: opts.limit,
    MinConfidence: opts.minConfidence
  }));

  // Sort by the labels by confidence.
  const sorted = res.Labels?.sort((a, b) => {
    return ((b.Confidence!) - (a.Confidence!));
  }) ?? [];

  // Extract labels from the response.
  for (const label of sorted) {
    if (label.Name) {
      labels.add(Label.from({ name: label.Name, confidence: label.Confidence!, type: 'General' }));
    }
  }

  // Extracting objects from the response.
  // A label is considered to be an object
  // if it has a defined bounding box.
  for (const label of sorted) {
    if (label.Name && label.Instances && label.Instances.length > 0) {
      for (const instance of label.Instances) {
        objects.push(DetectedObject.from({
          name: label.Name,
          confidence: instance.Confidence!,
          boundingBox: {
            left: instance.BoundingBox?.Left ?? 0,
            top: instance.BoundingBox?.Top ?? 0,
            width: instance.BoundingBox?.Width ?? 0,
            height: instance.BoundingBox?.Height ?? 0
          }
        }));
      }
    }
  }

  // Apply moderation filtering if enabled.
  if (opts.moderate?.value) {
    moderated = (await rekognition.send(new DetectModerationLabelsCommand({
      Image: {
        S3Object: {
          Bucket: decodeURIComponent(url.hostname),
          Name: decodeURIComponent(url.pathname.slice(1))
        }
      },
      MinConfidence: opts.moderate.minConfidence ?? 90
    }))).ModerationLabels ?? [];

    // Add moderated labels to the set of labels.
    for (const label of moderated) {
      if (label.Name) {
        labels.add(Label.from({ name: label.Name, confidence: label.Confidence!, type: 'Moderation' }));
      }
    }
  }

  return ({
    labels: Array.from(labels),
    moderated,
    objects
  });
};
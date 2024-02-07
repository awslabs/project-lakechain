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
import { DetectedText } from '@project-lakechain/sdk/models/document/metadata';
import { DetectTextOpts } from './opts.js';
import {
  RekognitionClient,
  DetectTextCommand
} from '@aws-sdk/client-rekognition';

/**
 * The Rekognition client to use.
 */
const rekognition = tracer.captureAWSv3Client(new RekognitionClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * Starts a text detection operation on the given image.
 * @param url the URL of the image to extract text from.
 * @param opts the options to use for the detection.
 * @returns an array of detected text.
 */
export const detectText = async (
  url: URL,
  opts: DetectTextOpts = { minConfidence: 90 }
): Promise<DetectedText[]> => {
  const res = await rekognition.send(new DetectTextCommand({
    Image: {
      S3Object: {
        Bucket: decodeURIComponent(url.hostname),
        Name: decodeURIComponent(url.pathname.slice(1))
      }
    },
    Filters: {
      WordFilter: {
        MinConfidence: opts.minConfidence
      }
    }
  }));

  return (res.TextDetections
    // Only keep the words.
    ?.filter(text => text.Type === 'WORD')
    // Limit the number of words to the given limit.
    .slice(0, opts.limit)
    // Transform into a normalized format.
    .map(text => DetectedText.from({
      text: text.DetectedText!,
      confidence: text.Confidence!,
      boundingBox: {
        left: text.Geometry?.BoundingBox?.Left ?? 0,
        top: text.Geometry?.BoundingBox?.Top ?? 0,
        width: text.Geometry?.BoundingBox?.Width ?? 0,
        height: text.Geometry?.BoundingBox?.Height ?? 0
      }
    })) ?? []
  );
};
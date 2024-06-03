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

import truncate from 'truncate-utf8-bytes';
import { tracer } from '@project-lakechain/sdk/powertools';
import { DocumentMetadata } from '@project-lakechain/sdk/models/document/metadata';
import {
  ComprehendClient,
  DetectDominantLanguageCommand
} from '@aws-sdk/client-comprehend';

/**
 * The Amazon Comprehend client.
 */
const comprehend = tracer.captureAWSv3Client(new ComprehendClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * Attempts to detect the language of the given text
 * using Amazon Comprehend.
 * @param text the text to analyze.
 * @param metadata the document metadata.
 * @returns the updated metadata.
 */
export const detectLanguage = async (
  text: string,
  metadata: DocumentMetadata,
  language?: string
): Promise<DocumentMetadata> => {
  // If the language is specified, we use it.
  if (language) {
    metadata.language = language;
    return (metadata);
  }

  try {
    // Detect the language using Amazon Comprehend.
    const res = await comprehend.send(new DetectDominantLanguageCommand({
      Text: truncate(text, 95_000)
    }));

    // If the result matches the confidence threshold, we
    // update the metadata.
    if (res.Languages && res.Languages.length > 0) {
      const languages = res.Languages.sort((a, b) => b.Score! - a.Score!);
      if (languages[0]?.LanguageCode) {
        metadata.language = languages[0].LanguageCode;
      }
    }
    return (metadata);
  } catch (err) {
    return (metadata);
  }
};
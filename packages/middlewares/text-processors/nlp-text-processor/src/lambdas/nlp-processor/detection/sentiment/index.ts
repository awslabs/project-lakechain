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
import { TextMetadata, Sentiment, DocumentMetadata } from '@project-lakechain/sdk/models/document/metadata';
import {
  ComprehendClient,
  DetectSentimentCommand,
  LanguageCode
} from '@aws-sdk/client-comprehend';

/**
 * The Amazon Comprehend client.
 */
const comprehend = tracer.captureAWSv3Client(new ComprehendClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * Attempts to detect the general sentiment across the
 * given text using Amazon Comprehend. If the text is
 * longer than 5KB of UTF-8 characters, it will be truncated,
 * and the result will be based on the truncated text.
 * @param text the text to analyze.
 * @param metadata the document metadata.
 * @param args the arguments associated with the operation.
 * @returns the updated metadata.
 */
export const detectSentiment = async (
  text: string,
  metadata: DocumentMetadata
): Promise<DocumentMetadata> => {
  try {
    // Detect the sentiment using Amazon Comprehend.
    const res = await comprehend.send(new DetectSentimentCommand({
      Text: truncate(text, 4_000),
      LanguageCode: metadata.language as LanguageCode
    }));

    // The attributes to update in the metadata.
    const attrs = metadata.properties?.attrs as TextMetadata;

    // If the result matches the confidence threshold, we
    // update the metadata.
    if (res.Sentiment && res.SentimentScore) {
      if (res.Sentiment === 'NEUTRAL') {
        attrs.sentiment = Sentiment.NEUTRAL;
      } else if (res.Sentiment === 'POSITIVE') {
        attrs.sentiment = Sentiment.POSITIVE;
      } else if (res.Sentiment === 'NEGATIVE') {
        attrs.sentiment = Sentiment.NEGATIVE;
      } else if (res.Sentiment === 'MIXED') {
        attrs.sentiment = Sentiment.MIXED;
      }
    }
    return (metadata);
  } catch (err) {
    return (metadata);
  }
};

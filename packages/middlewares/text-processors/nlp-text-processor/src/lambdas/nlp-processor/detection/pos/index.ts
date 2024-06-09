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
import { TextMetadata, PartOfSpeech, DocumentMetadata } from '@project-lakechain/sdk/models/document/metadata';
import { CacheStorage } from '@project-lakechain/sdk/cache';
import {
  ComprehendClient,
  DetectSyntaxCommand,
  SyntaxLanguageCode
} from '@aws-sdk/client-comprehend';

/**
 * The Amazon Comprehend client.
 */
const comprehend = tracer.captureAWSv3Client(new ComprehendClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * The default confidence threshold to apply to
 * NLP operations by default.
 */
const DEFAULT_CONFIDENCE = 0.9;

/**
 * The middleware cache storage.
 */
const cacheStorage = new CacheStorage();

/**
 * Attempts to extract the Part-of-Speech tags in the
 * given text using Amazon Comprehend. The tags will
 * be made available in the document metadata.
 * @param doc the document to analyze.
 * @param metadata the document metadata.
 * @param args the arguments associated with the operation.
 * @returns the updated metadata.
 * @example ADJ, ADP, ADV, AUX, CONJ, etc.
 */
export const detectPos = async (
  text: string,
  metadata: DocumentMetadata,
  opts: any
): Promise<DocumentMetadata> => {
  const pos: PartOfSpeech[] = [];
  const confidence = opts.minConfidence ?? DEFAULT_CONFIDENCE;
  const filter = opts.filter ?? [];

  try {
    // Detect the Part-of-Speech tags using Amazon Comprehend.
    const res = await comprehend.send(new DetectSyntaxCommand({
      Text: text,
      LanguageCode: metadata.language as SyntaxLanguageCode
    }));

    // If the metadata does not have properties, we initialize them.
    if (!metadata.properties) {
      metadata.properties = { kind: 'text', attrs: {} };
    }

    // The attributes to update in the metadata.
    const attrs = metadata.properties.attrs as TextMetadata;

    // If the result matches the confidence threshold, we
    // update the metadata.
    if (res.SyntaxTokens && res.SyntaxTokens.length > 0) {
      const filtered = res.SyntaxTokens
        .filter((token) => token.PartOfSpeech?.Score && token.PartOfSpeech.Score > confidence)
        .filter((token) => filter.length === 0 || filter.includes(token.PartOfSpeech!.Tag!))
        .map((token) => PartOfSpeech.from({
            tag: token.PartOfSpeech!.Tag!,
            text: token.Text!,
            score: token.PartOfSpeech!.Score!,
            startOffset: token.BeginOffset!,
            endOffset: token.EndOffset!
          })
        );
      pos.push(...filtered);
    }

    // Store the result into a pointer in the cache,
    // that other middlewares will be able to consume.
    attrs.pos = await cacheStorage.put('pos', pos);

    // Store the number of detected part-of-speech text in the statistics.
    attrs.stats = attrs.stats || {};
    attrs.stats.pos = pos.length;

    return (metadata);
  } catch (err) {
    console.error(err);
    return (metadata);
  }
};
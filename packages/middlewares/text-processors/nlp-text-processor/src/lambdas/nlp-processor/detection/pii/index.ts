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
import { TextMetadata, Pii, DocumentMetadata } from '@project-lakechain/sdk/models/document/metadata';
import { CacheStorage } from '@project-lakechain/sdk/cache';
import {
  ComprehendClient,
  DetectPiiEntitiesCommand,
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
 * The default confidence threshold to apply to
 * NLP operations by default.
 */
const DEFAULT_CONFIDENCE = 0.9;

/**
 * The middleware cache storage.
 */
const cacheStorage = new CacheStorage();

/**
 * Attempts to extract the PII (Personally Identifiable
 * Information) in the given text using Amazon Comprehend.
 * The entities will be made available in the document
 * metadata.
 * @param doc the document to analyze.
 * @param metadata the document metadata.
 * @param args the arguments associated with the operation.
 * @returns the updated metadata.
 * @example BANK_ACCOUNT_NUMBER, PIN, EMAIL, ADDRESS, NAME, PHONE, etc.
 */
export const detectPiiEntities = async (
  text: string,
  metadata: DocumentMetadata,
  opts: any
): Promise<DocumentMetadata> => {
  const piis: Pii[] = [];
  const confidence = opts.minConfidence ?? DEFAULT_CONFIDENCE;
  const filter = opts.filter ?? [];

  try {
    // Detect the entities using Amazon Comprehend.
    const res = await comprehend.send(new DetectPiiEntitiesCommand({
      Text: text,
      LanguageCode: metadata.language as LanguageCode
    }));

    // If the metadata does not have properties, we initialize them.
    if (!metadata.properties) {
      metadata.properties = { kind: 'text', attrs: {} };
    }

    // The attributes to update in the metadata.
    const attrs = metadata.properties.attrs as TextMetadata;

    // If the result matches the confidence threshold, we
    // update the metadata.
    if (res.Entities && res.Entities.length > 0) {
      const filtered = res.Entities
        .filter((entity) => entity.Score && entity.Score > confidence)
        .filter((entity) => filter.length === 0 || filter.includes(entity.Type!))
        .map((entity) => Pii.from({
          type: entity.Type!,
          text: text.substring(entity.BeginOffset!, entity.EndOffset!),
          score: entity.Score!,
          startOffset: entity.BeginOffset!,
          endOffset: entity.EndOffset!
        }));
      piis.push(...filtered);
    }

    // Store the result into a pointer in the cache,
    // that other middlewares will be able to consume.
    attrs.pii = await cacheStorage.put('piis', piis);
    
    // Store the number of detected PIIs in the statistics.
    attrs.stats = attrs.stats || {};
    attrs.stats.piis = piis.length;

    return (metadata);
  } catch (err) {
    return (metadata);
  }
};
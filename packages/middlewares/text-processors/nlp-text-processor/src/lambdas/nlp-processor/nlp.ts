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

import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';
import { Document, DocumentMetadata } from '@project-lakechain/sdk/models/document';

import {
  detectLanguage,
  detectSentiment,
  detectEntities,
  detectPiiEntities,
  detectPos,
  getReadingTime,
  getStats
} from './detection';

/**
 * The NLP engine.
 */
const engine = winkNLP(model);

/**
 * Represents a captured Nlp operation.
 */
export interface Operation {

  /**
   * The name of the operation.
   */
  op: string;

  /**
   * The arguments associated with the operation.
   */
  args: any[];

  /**
   * The priority of the operation.
   */
  priority: number;
}

/**
 * Applies the given NLP operations to the given document.
 * @param document the document to analyze.
 * @param ops the NLP operations to apply.
 * @returns the updated metadata.
 */
export const nlp = async (document: Document, ops: Operation[]): Promise<any> => {
  const text = (await document.data().asBuffer()).toString('utf-8');
  const doc  = engine.readDoc(text);
  const metadata: DocumentMetadata = {};

  metadata.properties = {
    kind: 'text',
    attrs: {
      stats: {}
    }
  };

  // We apply the operations in sequence.
  for (const op of ops) {
    const opts: any = op.args[0] ?? {};
    switch (op.op) {
      case 'language':
        await detectLanguage(text, metadata, opts.language);
        break;
      case 'sentiment':
        await detectSentiment(text, metadata);
        break;
      case 'entities':
        await detectEntities(text, metadata, opts);
        break;
      case 'pii':
        await detectPiiEntities(text, metadata, opts);
        break;
      case 'pos':
        await detectPos(text, metadata, opts);
        break;
      case 'readingTime':
        metadata.properties.attrs.readingTime = getReadingTime(doc, opts.wpm);
        break;
      case 'stats':
        getStats(metadata, doc);
        break;
      default:
        throw new Error(`Unsupported operation: ${op.op}`);
    }
  }

  return (metadata);
};
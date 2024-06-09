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
import { Document as WinkDocument } from 'wink-nlp';
import { DocumentMetadata, TextMetadata } from '@project-lakechain/sdk/models/document/metadata';

/**
 * The WinkNLP engine.
 */
const engine = winkNLP(model);

/**
 * @returns the number of words in the given document.
 * @param doc the document to analyze.
 */
export const getWordCount = (doc: WinkDocument): number => {
  return (doc.tokens()
    .out(engine.its.type)
    .filter((type) => type === 'word')
    .length
  );
};

/**
 * @param metadata the document metadata.
 * @param doc the document to analyze.
 * @returns a set of statistics about the given document.
 */
export const getStats = (metadata: DocumentMetadata, doc: WinkDocument): any => {
  if (!metadata.properties) {
    metadata.properties = { kind: 'text', attrs: {} };
  }

  // The metadata attributes.
  const attrs = metadata.properties.attrs as TextMetadata;

  attrs.stats = attrs.stats || {};
  attrs.stats.words = getWordCount(doc);
  attrs.stats.sentences = doc.sentences().out().length;
  return (metadata);
};

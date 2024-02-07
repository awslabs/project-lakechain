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
import { Document as WinkDocument } from 'wink-nlp';

/**
 * Chunk text into chunks of a maximum byte length.
 * @param doc The document to chunk.
 * @param maxByteLength The maximum byte length of each chunk.
 * @returns the document chunks.
 */
export const chunkText = (doc: WinkDocument, maxByteLength: number) => {
  const chunks: string[] = [];
  const sentences        = doc.sentences().out();
  let currentChunk       = '';

  sentences.forEach((sentence, idx) => {
    const chunkByteLength         = Buffer.byteLength(currentChunk, 'utf8');
    let currentSentence           = sentence;
    let currentSentenceByteLength = Buffer.byteLength(currentSentence, 'utf8');

    // If the UTF-8 sentence is longer in bytes than the
    // specified `maxByteLength`, we truncate it.
    if (currentSentenceByteLength > maxByteLength) {
      currentSentence = truncate(currentSentence, maxByteLength);
      currentSentenceByteLength = Buffer.byteLength(currentSentence, 'utf8');
    }

    // If the current chunk + the current sentence is longer
    // than the specified `maxByteLength`, we push the current
    // chunk to the chunks array and reset the current chunk
    // to the current sentence.
    if (currentSentenceByteLength + chunkByteLength > maxByteLength) {
      chunks.push(currentChunk);
      currentChunk = currentSentence;
    } else {
      currentChunk += currentSentence;
    }

    // If this is the last sentence, we push the current chunk
    // to the chunks array.
    if (idx === sentences.length - 1) {
      chunks.push(currentChunk);
    }
  });

  return (chunks);
};
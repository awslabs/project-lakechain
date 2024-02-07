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

import { Document as WinkDocument } from 'wink-nlp';
import { getWordCount } from '../stats';

/**
 * Estimates the reading time of the given document.
 * @param doc the document to analyze.
 * @param wpm an optional word per minute value to use.
 * @returns the estimated reading time in minutes.
 */
export const getReadingTime = (doc: WinkDocument, wpm = 265): number => {
  return (Math.ceil(getWordCount(doc) / wpm));
};

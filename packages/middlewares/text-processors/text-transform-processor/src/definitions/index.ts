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

import { Intent } from '@project-lakechain/core/dsl/intent';
import { Filter } from '@project-lakechain/core/dsl/vocabulary/filters';

/**
 * Describes a subject to redact, which has a name,
 * such as `pii`, `pos` or `entities`, and an optional
 * filter to apply on the subject.
 */
export type Subject = {
  name: string,
  filter?: string[]
};

/**
 * Describes a PII subject.
 */
export const pii = (filter?: Filter<string>): Subject => ({
  name: 'pii',
  filter: filter?.filter
});

/**
 * Describes a part-of-speech subject.
 */
export const pos = (filter?: Filter<string>): Subject => ({
  name: 'pos',
  filter: filter?.filter
});

/**
 * Describes an entity subject.
 */
export const entities = (filter?: Filter<string>): Subject => ({
  name: 'entities',
  filter: filter?.filter
});

/**
 * Describes text transform operations exposed
 * by the middleware. Operations are described
 * using a fluent API and serialized to the
 * text transform processing compute.
 */
export class TextTransformOperations implements Intent {

  constructor(
    private ops: any[] = []
  ) {}

  /**
   * Replaces a subject in the text document with
   * a given value.
   * @returns the current instance.
   */
  replace(subject: string, value: string, opts = { caseSensitive: true }): TextTransformOperations {
    const type = 'string';
    this.ops.push({ name: 'replace', params: { type, subject, value, ...opts }});
    return (this);
  }

  /**
   * Redacts a subject in the text document.
   * @returns the current instance.
   */
  redact(...subjects: Array<Subject>): TextTransformOperations {
    if (!subjects.length) {
      throw new Error('At least one subject must be specified to redact');
    }
    this.ops.push({ name: 'redact', params: { subjects }});
    return (this);
  }

  /**
   * Extracts a substring from the text document and
   * returns it.
   * @returns the current instance.
   */
  substring(startIdx: number, endIdx: number): TextTransformOperations {
    this.ops.push({ name: 'substring', params: { startIdx, endIdx }});
    return (this);
  }

  /**
   * Transforms the text document to base64.
   * @returns the current instance.
   */
  base64() {
    this.ops.push({ name: 'base64', params: {}});
    return (this);
  }

  /**
   * Compiles the intent into a string
   * representation.
   */
  compile(): string {
    if (!this.ops.length) {
      throw new Error('At least one operation must be specified');
    }
    return (JSON.stringify(this.ops));
  }
}

/**
 * Creates an NLP instance allowing to specify a sequence of
 * NLP operations to perform on text.
 * @returns A NLP instance that can be used to chain operations
 */
export function text(): TextTransformOperations {
  return (new TextTransformOperations());
}

export { confidence, filter } from '@project-lakechain/core/dsl/vocabulary/filters';
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
import { Filter, MinConfidence } from '@project-lakechain/core/dsl/vocabulary/filters';

/**
 * @param v the value to check.
 * @returns true if the value is defined.
 */
const def = (v: any) => typeof v !== 'undefined';

export interface OperationDescriptor {

  /**
   * The arguments associated with the operation.
   */
  args: any[];

  /**
   * The priority of the operation.
   */
  priority: number;
}

export interface Wpm {
  wpm: number;
}

export const wpm = (wpm: number): Wpm => ({ wpm });

/**
 * Describes NLP operations made available by a
 * middleware. Operations are described using a
 * fluent API and serialized to the NLP processing
 * compute.
 */
export class NlpOperations implements Intent {

  constructor(
    protected ops: Map<string, OperationDescriptor> = new Map<string, OperationDescriptor>()
  ) {}

  /**
   * Specifies that language detection should be performed.
   * If no language is specified, the language will be
   * detected automatically. If a language is specified,
   * the language will be used and no detection will be
   * performed.
   * @param language an optional language to use.
   * @returns the current instance.
   */
  language(language?: string): LanguageDependentOperations {
    this.ops.set('language', { args: [def(language) ? { language } : {}], priority: 1 });
    return (new LanguageDependentOperations(this.ops));
  }

  /**
   * Specifies that reading time detection should be performed.
   * @returns the current instance.
   */
  readingTime(opts?: Wpm): NlpOperations {
    this.ops.set('readingTime', { args: [def(opts) ? opts : {}], priority: 0 });
    return (this);
  }

  /**
   * Enriches the document metadata with statistics about
   * the processed text, such as the number of words and
   * sentences in the text.
   */
  stats(): NlpOperations {
    this.ops.set('stats', { args: [], priority: 0 });
    return (this);
  }

  /**
   * @returns the list of operations captured.
   */
  getOps(): Map<string, OperationDescriptor> {
    return (this.ops);
  }

  /**
   * Compiles the intent into a string
   * representation.
   */
  compile(): string {
    const ops = this.getOps();

    // Verify whether the operations are valid.
    if (!ops.size) {
      throw new Error('At least one operation must be specified');
    }

    // Convert the map to an array.
    const array = Array.from(ops, (entry) => {
      return { op: entry[0], args: entry[1].args, priority: entry[1].priority };
    });

    // Sort by priority.
    return (JSON.stringify(array.sort((a, b) => b.priority - a.priority)));
  }
}

/**
 * Describes language-dependent NLP operations that
 * require the language of a corpus of text to be
 * known ahead of time.
 */
export class LanguageDependentOperations extends NlpOperations {

  constructor(ops: Map<string, OperationDescriptor>) {
    super();
    this.ops = ops;
  }

  /**
   * Specifies that sentiment detection should be performed.
   * @returns the current instance.
   */
  sentiment(): LanguageDependentOperations {
    this.ops.set('sentiment', { args: [{}], priority: 0 });
    return (this);
  }

  /**
   * Specifies that PII detection should be performed.
   * @returns the current instance.
   */
  pii(...args: Array<MinConfidence | Filter<string>>): LanguageDependentOperations {
    const opts = {};
    args.forEach((arg: any) => Object.assign(opts, arg));
    this.ops.set('pii', { args: [opts], priority: 0 });
    return (this);
  }

  /**
   * Specifies that text entity detection should be performed.
   * @returns the current instance.
   */
  entities(...args: Array<MinConfidence | Filter<string>>): LanguageDependentOperations {
    const opts = {};
    args.forEach((arg: any) => Object.assign(opts, arg));
    this.ops.set('entities', { args: [opts], priority: 0 });
    return (this);
  }

  /**
   * Enables part-of-speech extraction for the detected language.
   * Part-of-speech analysis will extract tags from each token
   * in a given text, such as 'NOUN' or 'VERB'.
   * @see https://universaldependencies.org/u/pos/
   * @returns the current instance.
   */
  pos(...args: Array<MinConfidence | Filter<string>>): LanguageDependentOperations {
    const opts = {};
    args.forEach((arg: any) => Object.assign(opts, arg));
    this.ops.set('pos', { args: [opts], priority: 0 });
    return (this);
  }
}

/**
 * Creates an NLP instance allowing to specify a sequence of
 * NLP operations to perform on text.
 * @returns A NLP instance that can be used to chain operations
 */
export function nlp(): NlpOperations {
  return (new NlpOperations());
}

export { confidence, filter } from '@project-lakechain/core/dsl/vocabulary/filters';
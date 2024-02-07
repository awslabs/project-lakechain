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

import { z } from 'zod';

/**
 * Represents a part of speech extracted from a text document.
 * @example NOUN, VERB, ADJECTIVE, etc.
 */
export const PosSchema = z.object({
  tag: z.string(),
  text: z.string(),
  score: z.number(),
  startOffset: z.number(),
  endOffset: z.number()
});

/**
 * The part of speech properties.
 */
export type PosProps = z.infer<typeof PosSchema>;

/**
 * Represents a part of speech extracted from a text document.
 * @example NOUN, VERB, ADJECTIVE, etc.
 */
export class PartOfSpeech {

  /**
   * Pos constructor.
   * @param props the properties of the part of speech.
   */
  constructor(public props: PosProps) {}

  /**
   * @returns the part of speech tag.
   */
  public static from(data: any) {
    return (new PartOfSpeech(PosSchema.parse(data)));
  }

  /**
   * @returns the part of speech tag.
   */
  tag() {
    return (this.props.tag);
  }

  /**
   * @returns the text associated with the
   * part of speech.
   */
  text() {
    return (this.props.text);
  }

  /**
   * @returns the confidence score associated with the
   * part of speech.
   */
  score() {
    return (this.props.score);
  }

  /**
   * @returns the start offset of the part of speech.
   * The start offset is the index of the first character
   * of the part of speech in the text document.
   */
  startOffset() {
    return (this.props.startOffset);
  }

  /**
   * @returns the end offset of the part of speech.
   * The end offset is the index of the last character
   * of the part of speech in the text document.
   */
  endOffset() {
    return (this.props.endOffset);
  }

  /**
   * @returns the JSON representation of the part of speech.
   */
  toJSON() {
    return (this.props);
  }
}
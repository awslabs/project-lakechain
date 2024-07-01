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
 * Represents a PII (Personally Identifiable Information)
 * extracted from a text document.
 * @example EMAIL, PHONE_NUMBER, ADDRESS, etc.
 */
export const PiiSchema = z.object({
  type: z.string(),
  text: z.string(),
  score: z.number(),
  startOffset: z.number(),
  endOffset: z.number()
});

/**
 * The PII properties.
 */
export type PiiProps = z.infer<typeof PiiSchema>;

/**
 * Represents a personally identifiable information (PII)
 * extracted from a text document.
 * @example EMAIL, PHONE_NUMBER, ADDRESS, etc.
 */
export class Pii {

  /**
   * PII constructor.
   * @param props the properties of the PII.
   */
  constructor(public props: PiiProps) {}

  /**
   * @returns a new PII object.
   */
  public static from(data: any) {
    return (new Pii(PiiSchema.parse(data)));
  }

  /**
   * @returns the PII type.
   */
  type() {
    return (this.props.type);
  }

  /**
   * @returns the text associated with the
   * PII.
   */
  text() {
    return (this.props.text);
  }

  /**
   * @returns the confidence score associated with the
   * PII detection.
   */
  score() {
    return (this.props.score);
  }

  /**
   * @returns the start offset of the PII in the text document.
   */
  startOffset() {
    return (this.props.startOffset);
  }

  /**
   * @returns the end offset of the PII in the text document.
   */
  endOffset() {
    return (this.props.endOffset);
  }

  /**
   * @returns a JSON representation of the PII.
   */
  toJSON() {
    return (this.props);
  }
}

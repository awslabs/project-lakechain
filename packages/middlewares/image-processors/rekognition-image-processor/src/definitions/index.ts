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
import {
  Categories,
  IFilter,
  Label,
  Limit,
  MinConfidence,
  Range
} from '@project-lakechain/core/dsl/vocabulary/filters';

export interface OperationDescriptor {

  /**
   * The arguments associated with the operation.
   */
  args: any[];
}

/**
 * Possible emotions supported by the Amazon Rekognition
 * service.
 */
export type Emotion = "HAPPY"
  | "SAD"
  | "ANGRY"
  | "CONFUSED"
  | "DISGUSTED"
  | "SURPRISED"
  | "CALM"
  | "FEAR";

/**
 * Interface for a gender.
 */
export interface Gender extends IFilter {

  /**
   * The age to match.
   */
  gender: string;
}

/**
 * Describes a gender to be applied within a DSL
 * for describing an intent.
 * @param gender the gender to match.
 * @returns a gender descriptor.
 */
export const gender = (gender: string): Gender => ({ gender });

/**
 * Interface for emotions.
 */
export interface Emotions extends IFilter {

  /**
   * The emotions to match.
   */
  emotions: Emotion[];
}

/**
 * Describes an emotion to be applied within a DSL
 * for describing an intent.
 * @param emotions the emotions to match.
 * @returns an emotions descriptor.
 */
export const emotions = (...emotions: Emotion[]): Emotions => ({ emotions });

/**
 * Interface for an age range.
 */
export interface AgeRange extends IFilter {

  /**
   * The age to match.
   */
  age: Range<number>;
}

/**
 * Describes an age to be applied within a DSL
 * for describing an intent.
 * @param age the age to match.
 * @returns an age descriptor.
 */
export const age = (range: Range<number>): AgeRange => ({ age: range });

/**
 * Interface for a smile filter.
 */
export interface SmileFilter extends IFilter {
  smile: boolean;
}

/**
 * Describes a smile filter to be applied within a DSL
 * for describing an intent.
 * @param smile whether to match a smile or not.
 * @returns a smile descriptor.
 */
export const smile = (smile = true): SmileFilter => ({ smile });

/**
 * Interface for an attribute.
 */
export interface Attributes<T extends AgeRange | Gender | SmileFilter> extends IFilter {

  /**
   * The age to match.
   */
  attributes: { [key: string]: T };
}

/**
 * Describes an attribute to be applied within a DSL
 * for describing an intent.
 * @param attrs the attributes to match.
 * @returns an attribute descriptor.
 */
export const attributes = (...attrs: Array<AgeRange | Gender | SmileFilter>): Attributes<AgeRange | Gender | SmileFilter> => {
  const attributes = {};
  attrs.forEach((attr) => Object.assign(attributes, attr));
  return ({ attributes });
};

export type Moderation = { moderate: { value: boolean } & MinConfidence };

export const moderate = (confidence: MinConfidence): Moderation => ({ moderate: { value: true, minConfidence: confidence.minConfidence } });

/**
 * The types of PPE supported by Amazon Rekognition.
 */
export type Equipment = 'FACE_COVER' | 'HAND_COVER' | 'HEAD_COVER';

/**
 * Interface for a PPE filter.
 */
export interface EquipmentFilter extends IFilter {
  equipment: Equipment[];
}

/**
 * Describes a PPE filter to be applied within a DSL
 * for describing an intent.
 * @param equipment the equipment to match.
 * @returns a PPE descriptor.
 */
export const equipment = (...equipment: Equipment[]): EquipmentFilter => ({ equipment });

/**
 * Describes detection operations made available by the
 * Rekognition image processing middleware.
 * Operations are described using a fluent API and serialized
 * to the detection processing compute.
 */
export class DetectionOperations implements Intent {

  constructor(
    protected ops: Map<string, OperationDescriptor> = new Map<string, OperationDescriptor>()
  ) {}

  /**
   * Specifies that face detection should be performed.
   * You can pass additional parameters to set the minimum
   * confidence level and filter the features to be detected
   * on faces.
   * @param args a set of optional filters you can pass to customize
   * the face recognition process.
   * @returns the current instance.
   */
  faces(...args: Array<MinConfidence
    | Limit
    | Emotions
    | Attributes<AgeRange | Gender | SmileFilter>
  >): this {
    const opts = {};
    args.forEach((arg: any) => Object.assign(opts, arg));
    this.ops.set('faces', { args: [opts] });
    return (this);
  }

  /**
   * Specifies that label detection should be performed.
   * You can pass additional parameters to set the minimum
   * confidence level and specify filters to be applied
   * during the detection process.
   * @param args a set of optional filters you can pass to customize
   * the object detection process.
   * @returns the current instance.
   */
  labels(...args: Array<MinConfidence
    | Label<string>
    | Limit
    | Categories<string>
    | Moderation
  >): this {
    const opts = {};
    args.forEach((arg: any) => Object.assign(opts, arg));
    this.ops.set('labels', { args: [opts] });
    return (this);
  }

  /**
   * Specifies that text detection should be performed.
   * You can pass additional parameters to set the minimum
   * confidence level to filter out detections.
   * @param args a set of optional filters you can pass to customize
   * the text detection process.
   * @returns the current instance.
   */
  text(...args: Array<MinConfidence
    | Limit
  >): this {
    const opts = {};
    args.forEach((arg: any) => Object.assign(opts, arg));
    this.ops.set('text', { args: [opts] });
    return (this);
  }

  /**
   * Specifies that personal protective equipment detection should
   * be performed.
   * @param args a set of optional filters you can pass to customize
   * the personal protective equipment detection process.
   * @returns the current instance.
   */
  ppe(confidence: MinConfidence, equipment: EquipmentFilter): this {
    const opts = {
      minConfidence: confidence.minConfidence,
      requiredEquipment: equipment.equipment
    };
    this.ops.set('ppe', { args: [opts] });
    return (this);
  }

  /**
   * Compiles the intent into a string
   * representation.
   */
  compile(): string {
    // Verify whether the operations are valid.
    if (!this.ops.size) {
      throw new Error('At least one operation must be specified on the intent');
    }

    // Convert the map to an array.
    const array = Array.from(this.ops, (entry) => {
      return { op: entry[0], args: entry[1].args };
    });

    // Sort by priority.
    return (JSON.stringify(array));
  }
}

/**
 * Creates a detection intent for Amazon Rekognition.
 * @returns a detection intent that can be used to chain operations
 */
export function detect(): DetectionOperations {
  return (new DetectionOperations());
}

export {
  confidence,
  filter,
  limit,
  categories,
  labels
} from '@project-lakechain/core/dsl/vocabulary/filters';
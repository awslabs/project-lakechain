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

export interface IFilter {}

export interface MinConfidence extends IFilter {

  /**
   * The minimum confidence used to filter out
   * entities with a confidence lower than the
   * specified value.
   */
  minConfidence: number;
}

/**
 * Describes a confidence filter to be applied
 * within a DSL for describing an intent.
 * @param minConfidence the desired minimum confidence.
 * @returns a filter descriptor.
 */
export const confidence = (minConfidence: number): MinConfidence => ({ minConfidence });

/**
 * Interface for a filter.
 */
export interface Filter<T> extends IFilter {

  /**
   * The list of entities to match.
   */
  filter: T[];
}

/**
 * Describes a filter to be applied within a DSL
 * for describing an intent.
 * @param filter the list of entities to filter out.
 * @returns a filter descriptor.
 */
export const filter = <T = string>(...filter: T[]): Filter<T> => ({ filter });

/**
 * Interface for a feature.
 */
export interface Feature<T> extends IFilter {

  /**
   * The list of features to match.
   */
  features: T[];
}

/**
 * Describes a feature to be applied within a DSL
 * for describing an intent.
 * @param features the list of features to match.
 * @returns a feature descriptor.
 */
export const features = <T = string>(...features: T[]): Feature<T> => ({ features });

/**
 * Interface for a label.
 */
export interface Label<T> extends IFilter {

  /**
   * The list of labels to match.
   */
  labels: T[];
}

/**
 * Describes a label to be applied within a DSL
 * for describing an intent.
 * @param labels the list of labels to match.
 * @returns a label descriptor.
 */
export const labels = <T = string>(...labels: T[]): Label<T> => ({ labels });

/**
 * Interface for actions.
 */
export interface Actions<T> extends IFilter {

  /**
   * The list of actions to perform.
   */
  actions: T[];
}

/**
 * Describes actions to be applied within a DSL
 * for describing an intent.
 * @param actions the list of actions to match.
 * @returns a concept descriptor.
 */
export const actions = <T = string>(...args: T[]): Actions<T> => ({ actions: args });

/**
 * Interface for a limit.
 */
export interface Limit extends IFilter {

  /**
   * The maximum number of entities to match.
   */
  limit: number;
}

/**
 * Describes a maximum set to be applied within a DSL
 * for describing an intent.
 * @param limit the maximum number of entities to match.
 * @returns a maximum descriptor.
 */
export const limit = (limit: number): Limit => ({ limit });

/**
 * Interface for a category.
 */
export interface Categories<T> extends IFilter {

  /**
   * The list of categories to match.
   */
  categories: T[];
}

/**
 * Describes a set of categories to be applied within a DSL
 * for describing an intent.
 * @param categories the list of categories to match.
 * @returns a categories descriptor.
 */
export const categories = <T = string>(...categories: T[]): Categories<T> => ({ categories });

/**
 * Interface for a range.
 */
export interface Range<T> extends IFilter {

  range: {
    /**
     * The left-hand side of the range.
     */
    lhs: T;

    /**
     * The right-hand side of the range.
     */
    rhs: T;
  }
}

/**
 * Describes a range to be applied within a DSL
 * for describing an intent.
 * @param categories the list of categories to match.
 * @returns a categories descriptor.
 */
export const between = <T = string>(lhs: T, rhs: T): Range<T> => ({ range: { lhs, rhs } });

/**
 * Interface for a binary operator.
 */
export interface BinaryOperator extends IFilter {

  /**
   * The value associated with the operator.
   */
  value: boolean;
}

export interface Exclusion<T> extends IFilter {

  /**
   * The list of entities to filter out.
   */
  exclude: T[];
}

/**
 * Describes an exclusion to be applied within a DSL
 * for describing an intent.
 * @param exclude the list of entities to filter out.
 * @returns an exclusion descriptor.
 */
export const exclude = <T = string>(...exclude: T[]): Exclusion<T> => ({ exclude });

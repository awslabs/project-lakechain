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
 * Supported k-NN methods.
 */
export const KnnMethodSchema = z.enum([
  'hnsw'
]);
export type KnnMethod = z.infer<typeof KnnMethodSchema>;

/**
 * Supported k-NN engines.
 */
export const KnnEngineSchema = z.enum([
  'faiss',
  'nmslib'
]);
export type KnnEngine = z.infer<typeof KnnEngineSchema>;

/**
 * Supported space types.
 */
export const SpaceTypeSchema = z.enum([
  'l2',
  'l1',
  'innerproduct',
  'cosinesimil',
  'linf'
]);
export type SpaceType = z.infer<typeof SpaceTypeSchema>;

/**
 * The OpenSearch index definition properties.
 */
export const OpenSearchVectorIndexDefinitionPropsSchema = z.object({

  /**
   * The name of the index.
   */
  indexName: z.string(),

  /**
   * The method definition refers to the underlying configuration of the
   * Approximate k-NN algorithm to use.
   * @see https://opensearch.org/docs/latest/search-plugins/knn/knn-index#method-definitions
   */
  knnMethod: KnnMethodSchema,

  /**
   * The approximate k-NN library to use for indexing and search.
   * The supported libraries are faiss and nmslib.
   * @see https://opensearch.org/docs/latest/search-plugins/knn/knn-index#method-definitions
   */
  knnEngine: KnnEngineSchema,

  /**
   * The vector space used to calculate the distance between vectors.
   * @see https://opensearch.org/docs/latest/search-plugins/knn/knn-index#method-definitions
   */
  spaceType: SpaceTypeSchema,

  /**
   * The number of dimensions in the vector.
   */
  dimensions: z.number(),

  /**
   * The size of the dynamic list used during k-NN searches.
   * Higher values lead to more accurate but slower searches.
   * Only available for nmslib.
   * @see https://opensearch.org/docs/latest/search-plugins/knn/knn-index#method-definitions
   */
  efSearch: z
    .number()
    .default(512),

  /**
   * The parameters used for the nearest neighbor method.
   * @see https://opensearch.org/docs/latest/search-plugins/knn/knn-index#method-definitions
   */
  parameters: z.record(z.any())
});

// Export the `OpenSearchVectorIndexDefinitionProps` type.
export type OpenSearchVectorIndexDefinitionProps = z.infer<typeof OpenSearchVectorIndexDefinitionPropsSchema>;

/**
 * The OpenSearch index definition builder.
 */
export class OpenSearchIndexDefinitionBuilder {

  /**
   * The OpenSearch index definition properties.
   */
  private props: Partial<OpenSearchVectorIndexDefinitionProps> = {};

  /**
   * @param indexName the name of the index.
   * @returns the OpenSearch index definition builder.
   */
  public withIndexName(indexName: string) {
    this.props.indexName = indexName;
    return (this);
  }

  /**
   * @param knnMethod the k-NN method.
   * @returns the OpenSearch index definition builder.
   */
  public withKnnMethod(knnMethod: KnnMethod) {
    this.props.knnMethod = knnMethod;
    return (this);
  }

  /**
   * @param knnEngine the k-NN engine.
   * @returns the OpenSearch index definition builder.
   */
  public withKnnEngine(knnEngine: KnnEngine) {
    this.props.knnEngine = knnEngine;
    return (this);
  }

  /**
   * @param spaceType the space type.
   * @returns the OpenSearch index definition builder.
   */
  public withSpaceType(spaceType: SpaceType) {
    this.props.spaceType = spaceType;
    return (this);
  }

  /**
   * @param dimensions the vector dimensions.
   * @returns the OpenSearch index definition builder.
   */
  public withDimensions(dimensions: number) {
    this.props.dimensions = dimensions;
    return (this);
  }

  /**
   * @param efSearch the size of the dynamic list used during k-NN searches.
   * @returns the OpenSearch index definition builder.
   */
  public withEfSearch(efSearch: number) {
    this.props.efSearch = efSearch;
    return (this);
  }

  /**
   * @param parameters the parameters.
   * @returns the OpenSearch index definition builder.
   */
  public withParameters(parameters: any) {
    this.props.parameters = parameters;
    return (this);
  }

  /**
   * @returns a new OpenSearch index definition.
   */
  public build() {
    return (OpenSearchVectorIndexDefinition.from(this.props));
  }
}

/**
 * Represents an OpenSearch vector index definition.
 */
export class OpenSearchVectorIndexDefinition {

  /**
   * The builder constructor.
   */
  public static readonly Builder = OpenSearchIndexDefinitionBuilder;

  /**
   * OpenSearch index definition constructor.
   * @param props the properties of the OpenSearch index definition.
   */
  constructor(public props: OpenSearchVectorIndexDefinitionProps) {}

  /**
   * @returns the name of the index.
   */
  indexName() {
    return (this.props.indexName);
  }

  /**
   * @returns the k-NN method.
   */
  knnMethod() {
    return (this.props.knnMethod);
  }

  /**
   * @returns the k-NN engine.
   */
  knnEngine() {
    return (this.props.knnEngine);
  }

  /**
   * @returns the space type.
   */
  spaceType() {
    return (this.props.spaceType);
  }

  /**
   * @returns the vector dimensions.
   */
  dimensions() {
    return (this.props.dimensions);
  }

  /**
   * @returns the size of the dynamic list used during k-NN searches.
   */
  efSearch() {
    return (this.props.efSearch);
  }

  /**
   * @returns the parameters.
   */
  parameters() {
    return (this.props.parameters);
  }

  /**
   * @returns a new OpenSearch index definition.
   */
  public static from(data: any) {
    return (new OpenSearchVectorIndexDefinition(OpenSearchVectorIndexDefinitionPropsSchema.parse(data)));
  }
}
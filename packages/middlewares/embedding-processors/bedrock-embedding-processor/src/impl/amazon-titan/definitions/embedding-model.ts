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

/**
 * Specific properties associated with Titan
 * embedding models.
 */
export interface TitanModelProps {
  
  /**
   * The input mime-types supported by the model.
   */
  inputs: string[];

  /**
   * Whether the model supports setting an embedding size.
   */
  supportsEmbeddingSize: boolean;
}

/**
 * An array of base input mime-types supported
 * by Titan text embedding models.
 */
export const BASE_TEXT_INPUTS = [
  'text/plain',
  'text/markdown'
];

/**
 * An array of base input mime-types supported
 * by the Titan multimodal embedding models.
 */
export const BASE_IMAGE_INPUTS = [
  'image/png',
  'image/jpeg'
];

/**
 * The available embedding models provided
 * by Amazon Titan on Amazon Bedrock.
 */
export class TitanEmbeddingModel {

  /**
   * The Bedrock `amazon.titan-embed-text-v1` embedding model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/embeddings.html
   */
  static readonly AMAZON_TITAN_EMBED_TEXT_V1 = new TitanEmbeddingModel('amazon.titan-embed-text-v1', {
    inputs: BASE_TEXT_INPUTS,
    supportsEmbeddingSize: false
  });

  /**
   * The Bedrock `amazon.titan-embed-text-v2:0` embedding model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/embeddings.html
   */
  static readonly AMAZON_TITAN_EMBED_TEXT_V2 = new TitanEmbeddingModel('amazon.titan-embed-text-v2:0', {
    inputs: BASE_TEXT_INPUTS,
    supportsEmbeddingSize: false
  });

  /**
   * The Bedrock `amazon.titan-embed-image-v1` embedding model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/embeddings.html
   */
  static readonly AMAZON_TITAN_EMBED_IMAGE_V1 = new TitanEmbeddingModel('amazon.titan-embed-image-v1', {
    inputs: BASE_IMAGE_INPUTS,
    supportsEmbeddingSize: true
  });

  /**
   * Create a new instance of the `TitanEmbeddingModel`
   * by name.
   * @param name the name of the model.
   * @param props the properties of the embedding model.
   * @returns a new instance of the `TitanEmbeddingModel`.
   */
  public static of(name: string, props: TitanModelProps) {
    return (new TitanEmbeddingModel(name, props));
  }

  /**
   * `TitanEmbeddingModel` constructor.
   * @param name the name of the embedding model.
   * @param props the properties of the embedding model.
   */
  constructor(public name: string, public props: TitanModelProps) {}
}

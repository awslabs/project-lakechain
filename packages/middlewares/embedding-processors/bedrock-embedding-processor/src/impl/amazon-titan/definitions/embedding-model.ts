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
   * The dimensions of the embedding model.
   */
  dimensions?: number;

  /**
   * The maximum number of tokens that the
   * embedding model can process.
   */
  maxTokens?: number;
}

/**
 * The available embedding models provided
 * by Amazon Titan on Amazon Bedrock.
 */
export class TitanEmbeddingModel {

  /**
   * The Bedrock `amazon.titan-embed-text-v1` embedding model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/embeddings.html
   */
  public static AMAZON_TITAN_EMBED_TEXT_V1 = new TitanEmbeddingModel('amazon.titan-embed-text-v1', {
    dimensions: 1536,
    maxTokens: 8192
  });

  /**
   * Create a new instance of the `TitanEmbeddingModel`
   * by name.
   * @param name the name of the model.
   * @param props the properties of the embedding model.
   * @returns a new instance of the `TitanEmbeddingModel`.
   */
  public static of(name: string, props?: TitanModelProps) {
    return (new TitanEmbeddingModel(name, props));
  }

  constructor(public name: string, public props?: TitanModelProps) {}
}

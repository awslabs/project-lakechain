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
 * Specific properties associated with Cohere
 * embedding models.
 */
export interface CohereModelProps {
  
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
 * by Cohere on Amazon Bedrock.
 */
export class CohereEmbeddingModel {

  /**
   * The Bedrock `cohere.embed-english-v3` embedding model.
   */
  public static COHERE_EMBED_ENGLISH_V3 = new CohereEmbeddingModel('cohere.embed-english-v3', {
    dimensions: 1024,
    maxTokens: 512
  });

  /**
   * The Bedrock `cohere.embed-multilingual-v3` embedding model.
   */
  public static COHERE_EMBED_MULTILINGUAL_V3 = new CohereEmbeddingModel('cohere.embed-multilingual-v3', {
    dimensions: 1024,
    maxTokens: 512
  });

  /**
   * Create a new instance of the `CohereEmbeddingModel`
   * by name.
   * @param name the name of the model.
   * @param props the properties of the embedding model.
   * @returns a new instance of the `CohereEmbeddingModel`.
   */
  public static of(name: string, props?: CohereModelProps) {
    return (new CohereEmbeddingModel(name, props));
  }

  constructor(public name: string, public props?: CohereModelProps) {}
}

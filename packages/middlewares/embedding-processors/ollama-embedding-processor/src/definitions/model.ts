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

export interface OllamaEmbeddingModelDefinition {
  
  /**
   * The tag of the model.
   */
  tag: string;

  /**
   * The input mime-types supported by the model.
   */
  inputs: string[];

  /**
   * The output mime-types supported by the model.
   */
  outputs: string[];
}

/**
 * An array of base input mime-types
 * supported by ollama text models.
 */
export const BASE_TEXT_INPUTS = [
  'text/plain',
  'text/markdown'
];

/**
 * A helper to select an embedding model supported
 * by Ollama.
 */
export class OllamaEmbeddingModel {

  /**
   * The `nomic-embed-text` model.
   * @see https://ollama.com/library/nomic-embed-text
   */
  public static readonly NOMIC_EMBED_TEXT = new OllamaEmbeddingModel('nomic-embed-text', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: BASE_TEXT_INPUTS
  });

  /**
   * The `mxbai-embed-large` model.
   * @see https://ollama.com/library/mxbai-embed-large
   */
  public static readonly MXBAI_EMBED_LARGE = new OllamaEmbeddingModel('mxbai-embed-large', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: BASE_TEXT_INPUTS
  });

  /**
   * The `all-minilm` model.
   * @see https://ollama.com/library/all-minilm
   */
  public static readonly ALL_MINILM = new OllamaEmbeddingModel('all-minilm', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: BASE_TEXT_INPUTS
  });

  /**
   * The `snowflake-arctic-embed` model.
   * @see https://ollama.com/library/snowflake-arctic-embed
   */
  public static readonly SNOWFLAKE_ARCTIC_EMBED = new OllamaEmbeddingModel('snowflake-arctic-embed', {
    tag: 'latest',
    inputs: BASE_TEXT_INPUTS,
    outputs: BASE_TEXT_INPUTS
  });

  /**
   * Create a new instance of the `OllamaEmbeddingModel`
   * by name.
   * @param name the name of the model.
   * @returns a new instance of the `OllamaEmbeddingModel`.
   */
  public static of(
    name: string,
    opts: { tag: string }
  ) {
    return (new OllamaEmbeddingModel(name, {
      tag: opts.tag,
      inputs: BASE_TEXT_INPUTS,
      outputs: BASE_TEXT_INPUTS
    }));
  }

  /**
   * Creates a new instance of the `OllamaEmbeddingModel` class.
   * @param name the name of the model.
   * @param definition the model definition.
   */
  constructor(
    public name: string,
    public definition: OllamaEmbeddingModelDefinition
  ) {}

  /**
   * Sets the tag of the model.
   * @param tag the tag of the model.
   * @returns the model instance.
   */
  public tag(tag: string) {
    this.definition.tag = tag;
    return (this);
  }
}

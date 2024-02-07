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
 * A helper to select an embedding model to be used
 * by KeyBERT.
 */
export class KeybertEmbeddingModel {

  /**
   * The `all-mpnet-base-v2` model.
   * @see https://huggingface.co/sentence-transformers/all-mpnet-base-v2
   */
  public static ALL_MPNET_BASE_V2 = new KeybertEmbeddingModel(
    'all-mpnet-base-v2'
  );

  /**
   * The `all-MiniLM-L6-v2` model.
   * @see https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
   */
  public static ALL_MINI_LM_L6_V2 = new KeybertEmbeddingModel(
    'all-MiniLM-L6-v2'
  );

  /**
   * The `all-MiniLM-L12-v2` model.
   * @see https://huggingface.co/sentence-transformers/all-MiniLM-L12-v2
   */
  public static ALL_MINI_LM_L12_V2 = new KeybertEmbeddingModel(
    'all-MiniLM-L12-v2'
  );

  /**
   * Create a new instance of the `KeybertEmbeddingModel`
   * by name.
   * @param name the name of the model.
   * @returns a new instance of the `KeybertEmbeddingModel`.
   */
  public static of(name: string) {
    return (new KeybertEmbeddingModel(name));
  }

  constructor(public name: string) {}
}

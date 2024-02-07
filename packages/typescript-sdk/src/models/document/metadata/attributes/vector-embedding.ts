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

import { number, z } from 'zod';
import { PointerBuilder } from '../../../../pointer';

/**
 * Describes the schema for a vector embedding.
 */
export const VectorEmbeddingSchema = z.object({

  /**
   * The vectors associated with the embedding.
   */
  vectors: z
    .string()
    .url()
    .transform((url) => {
      return (new PointerBuilder<Array<number>>()
        .withUri(url)
        .withClassType(number)
        .build());
    }),

  /**
   * The identifier of the model used to generate
   * the embeddings.
   */
  model: z.string(),

  /**
   * The number of dimensions of the embeddings.
   */
  dimensions: z.number()
});

// The vector embedding properties.
export type VectorEmbeddingProps = z.infer<typeof VectorEmbeddingSchema>;

/**
 * Represents a vector embedding.
 */
export class VectorEmbedding {

  /**
   * Vector embedding constructor.
   * @param props the properties of the vector embedding.
   */
  constructor(public props: VectorEmbeddingProps) {}

  /**
   * @returns a new vector embedding object.
   */
  public static from(data: any) {
    return (new VectorEmbedding(VectorEmbeddingSchema.parse(data)));
  }

  /**
   * @returns a promise that resolves the embeddings
   * associated with the document.
   */
  embeddings(): Promise<Array<number>> {
    return (this.props.vectors.resolve());
  }

  /**
   * @returns the identifier of the model used to generate
   * the embeddings.
   */
  model() {
    return (this.props.model);
  }

  /**
   * @returns the number of dimensions of the embeddings.
   */
  dimensions() {
    return (this.props.dimensions);
  }
}
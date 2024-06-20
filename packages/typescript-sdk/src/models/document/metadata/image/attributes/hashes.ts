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
 * References different types of hashes that can be
 * used to compare how similar two images are.
 */
export const HashesSchema = z.object({

  /**
   * The perceptual hash of the image.
   * @see https://en.wikipedia.org/wiki/Perceptual_hashing
   */
  perceptual: z
    .string()
    .describe('The perceptual hash of the image.')
    .optional(),

  /**
   * The average hash of the image.
   * @see https://www.hackerfactor.com/blog/index.php?/archives/432-Looks-Like-It.html
   */
  average: z
    .string()
    .describe('The average hash of the image.')
    .optional(),

  /**
   * The median hash of the image.
   * @see https://content-blockchain.org/research/testing-different-image-hash-functions/
   */
  median: z
    .string()
    .describe('The median hash of the image.')
    .optional(),

  /**
   * The difference hash of the image.
   * @see https://github.com/Tom64b/dHash
   */
  difference: z
    .string()
    .describe('The difference hash of the image.')
    .optional(),

  /**
   * The crop-resistant hash of the image.
   * @see https://ieeexplore.ieee.org/document/6980335
   */
  cropResistant: z
    .string()
    .describe('The crop-resistant hash of the image.')
    .optional(),

  /**
   * The wavelet hash of the image.
   * @see https://fullstackml.com/wavelet-image-hash-in-python-3504fdd282b5
   */
  wavelet: z
    .string()
    .describe('The wavelet hash of the image.')
    .optional()
});

export type Hashes = z.infer<typeof HashesSchema>;
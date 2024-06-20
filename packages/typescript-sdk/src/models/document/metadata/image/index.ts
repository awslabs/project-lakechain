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
import { ColorSchema } from '../attributes/color.js';
import { DimensionsSchema } from '../attributes/dimensions.js';
import { GeolocationSchema } from '../attributes/geolocation.js';
import { Face } from '../attributes/face.js';
import { Label } from '../attributes/label.js';
import { DetectedObject } from './attributes/detected-object.js';
import { DetectedText } from './attributes/detected-text.js';
import { ImageStatsSchema } from './attributes/image-stats.js';
import { PersonalProtectiveEquipmentSchema } from './attributes/ppe.js';
import { HashesSchema } from './attributes/hashes.js';
import { VectorEmbeddingSchema } from '../attributes/vector-embedding.js';
import { PointerBuilder } from '../../../../pointer';

/**
 * Represents additional metadata associated with
 * an image document.
 */
export const ImageMetadataSchema = z.object({

  /**
   * The dimensions (width and height) of the image.
   */
  dimensions: DimensionsSchema
    .describe('The dimensions of the image.')
    .optional(),

  /**
   * The format of the image.
   */
  format: z
    .string()
    .describe('The format of the image.')
    .optional(),

  /**
   * The dominant color of the image.
   */
  dominantColor: ColorSchema
    .describe('The dominant color of the image.')
    .optional(),

  /**
   * An URL to a thumbnail associated with
   * the image.
   */
  thumbnail: z
    .string()
    .url()
    .describe('An URL to a thumbnail associated with the image.')
    .optional(),

  /**
   * The orientation of the image.
   */
  orientation: z
    .any()
    .describe('The orientation of the image.')
    .optional(),

  /**
   * The EXIF metadata associated with the image.
   * This is a free form object that can contain
   * any EXIF metadata.
   */
  exif: z
    .record(z.any())
    .describe('The EXIF metadata associated with the image.')
    .optional(),

  /**
   * The geolocation associated with the image.
   */
  geolocation: GeolocationSchema
    .describe('The geolocation associated with the image.')
    .optional(),

  /**
   * The detected faces in the image.
   */
  faces: z
    .string()
    .url()
    .describe('The detected faces in the image.')
    .transform((url) => {
      return (new PointerBuilder<Array<Face>>()
        .withUri(url)
        .withClassType(Face)
        .build());
    }).optional(),

  /**
   * The detected labels in the image.
   */
  labels: z
    .string()
    .url()
    .describe('The detected labels in the image.')
    .transform((url) => {
      return (new PointerBuilder<Array<Label>>()
        .withUri(url)
        .withClassType(Label)
        .build());
    }).optional(),

  /**
   * The detected objects in the image.
   */
  objects: z
    .string()
    .url()
    .describe('The detected objects in the image.')
    .transform((url) => {
      return (new PointerBuilder<Array<DetectedObject>>()
        .withUri(url)
        .withClassType(DetectedObject)
        .build());
    }).optional(),

  /**
   * The detected text in the image.
   */
  text: z
    .string()
    .url()
    .describe('The detected text in the image.')
    .transform((url) => {
      return (new PointerBuilder<Array<DetectedText>>()
        .withUri(url)
        .withClassType(DetectedText)
        .build());
    }).optional(),

  /**
   * The vector embeddings associated with the image document.
   */
  embeddings: VectorEmbeddingSchema
    .describe('The vector embeddings associated with the image document.')
    .optional(),

  /**
   * The detected personal protective equipment
   * in the image.
   */
  ppe: PersonalProtectiveEquipmentSchema
    .describe('The detected personal protective equipment in the image.')
    .optional(),

  /**
   * Statistics about the image.
   */
  stats: ImageStatsSchema
    .describe('Statistics about the image.')
    .optional(),

  /**
   * The laplacian variance of the image.
   */
  laplacianVariance: z
    .number()
    .describe('The laplacian variance of the image.')
    .optional(),

  /**
   * Describes the hashes associated with the image.
   */
  hashes: HashesSchema
    .describe('Describes the hashes associated with the image.')
    .optional(),

  /**
   * User defined metadata of the image.
   */
  custom: z
    .record(z.any())
    .describe('User defined metadata of the image.')
    .optional()
});

export type ImageMetadata = z.infer<typeof ImageMetadataSchema>;

export * from '../attributes/color.js';
export * from '../attributes/dimensions.js';
export * from '../attributes/geolocation.js';
export * from '../attributes/face.js';
export * from '../attributes/label.js';
export * from './attributes';

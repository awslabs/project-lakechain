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
 * The schema associated with the image generation parameters.
 */
export const ImageGenerationParametersSchema = z.object({

  /**
   * The number of images to generate.
   * @min 1
   * @max 5
   */
  numberOfImages: z
    .number()
    .min(1)
    .max(5)
    .optional(),

  /**
   * The quality of the generated images.
   */
  quality: z.union([
    z.literal('standard'),
    z.literal('premium')
  ]).optional(),

  /**
   * The desired height of the generated images.
   */
  height: z
    .number()
    .optional(),
  
  /**
   * The desired width of the generated images.
   */
  width: z
    .number()
    .optional(),

  /**
   * Determines how much the final image portrays the prompt.
   * Use a lower number to increase randomness in the generation.
   * @min 1.1
   * @max 10.0
   */
  cfgScale: z
    .number()
    .min(1.1)
    .max(10.0)
    .optional(),

  /**
   * Determines the initial noise.
   * Using the same seed with the same settings and prompt will create similar images.
   * @min 0
   * @max 214783647
   */
  seed: z
    .number()
    .min(0)
    .max(214783647)
    .optional()
  
}).passthrough();

// Export the `ImageGenerationParametersProps` type.
export type ImageGenerationParametersProps = z.infer<typeof ImageGenerationParametersSchema>;

/**
 * The image generation parameter builder.
 */
export class ImageGenerationParametersBuilder {

  /**
   * The image generation properties.
   */
  private props: Partial<ImageGenerationParametersProps> = {};

  /**
   * Sets the number of images to generate.
   * @param numberOfImages the number of images to generate.
   */
  public withNumberOfImages(numberOfImages: number) {
    this.props.numberOfImages = numberOfImages;
    return (this);
  }

  /**
   * Sets the quality of the generated images.
   * @param quality the quality of the generated images.
   */
  public withQuality(quality: 'standard' | 'premium') {
    this.props.quality = quality;
    return (this);
  }

  /**
   * Sets the desired height of the generated images.
   * @param height the desired height of the generated images.
   */
  public withHeight(height: number) {
    this.props.height = height;
    return (this);
  }

  /**
   * Sets the desired width of the generated images.
   * @param width the desired width of the generated images.
   */
  public withWidth(width: number) {
    this.props.width = width;
    return (this);
  }

  /**
   * Sets the scale of the configuration.
   * @param cfgScale the scale of the configuration.
   */
  public withCfgScale(cfgScale: number) {
    this.props.cfgScale = cfgScale;
    return (this);
  }

  /**
   * Sets the seed for the generation.
   * @param seed the seed for the generation.
   */
  public withSeed(seed: number) {
    this.props.seed = seed;
    return (this);
  }

  /**
   * @returns a new instance of the `ImageGenerationParameters`
   * service constructed with the given parameters.
   */
  public build(): ImageGenerationParameters {
    return (ImageGenerationParameters.from(this.props));
  }
}

/**
 * The image generation parameters.
 */
export class ImageGenerationParameters {

  /**
   * The builder constructor.
   */
  public static readonly Builder = ImageGenerationParametersBuilder;

  /**
   * Image generation parameters constructor.
   * @param props the properties associated with the image generation.
   */
  constructor(public props: ImageGenerationParametersProps) {}

  /**
   * @returns the number of images to generate.
   */
  public numberOfImages() {
    return (this.props.numberOfImages);
  }

  /**
   * @returns the quality of the generated images.
   */
  public quality() {
    return (this.props.quality);
  }

  /**
   * @returns the desired height of the generated images.
   */
  public height() {
    return (this.props.height);
  }

  /**
   * @returns the desired width of the generated images.
   */
  public width() {
    return (this.props.width);
  }

  /**
   * @returns the scale of the configuration.
   */
  public cfgScale() {
    return (this.props.cfgScale);
  }

  /**
   * @returns the seed for the generation.
   */
  public seed() {
    return (this.props.seed);
  }

  /**
   * @returns a new instance of the `ImageGenerationParameters`.
   */
  public static from(data: any): ImageGenerationParameters {
    return (new ImageGenerationParameters(ImageGenerationParametersSchema.parse(data)));
  }

  /**
   * @returns the JSON representation of the image generation parameters.
   */
  public toJSON() {
    return (this.props);
  }
}

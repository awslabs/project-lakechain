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

import * as dsl from '@project-lakechain/core/dsl';
import { z } from 'zod';
import { ImageGenerationParameters } from '../image-generation-props';

/**
 * Describes the schema for image variation task properties.
 */
const ImageVariationTaskPropsSchema = z.object({

  /**
   * A unique identifier for the task.
   */
  taskType: z.literal('IMAGE_VARIATION'),

  /**
   * The prompt associated with the task.
   */
  text: z
    .custom<dsl.IReference<any>>()
    .optional(),

  /**
   * The negative prompt to use when generating images.
   */
  negativeText: z
    .custom<dsl.IReference<any>>()
    .optional(),

  /**
   * Specifies an image to use for the generation.
   * @default uses the current document.
   */
  image: z
    .custom<dsl.IReference<any>>()
    .default(dsl.reference(dsl.document())),

  /**
   * The image generation parameters.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-image.html
   */
  imageGenerationParameters: z.custom<ImageGenerationParameters>()
    .optional()
});

// The type of the `ImageVariationProps` schema.
export type ImageVariationProps = z.infer<typeof ImageVariationTaskPropsSchema>;

/**
 * The image variation task builder.
 */
export class ImageVariationTaskBuilder {

  /**
   * The image variation task properties.
   */
  private props: Partial<ImageVariationProps> = {
    taskType: 'IMAGE_VARIATION'
  };

  /**
   * @param prompt the text prompt to use.
   * @returns the current builder instance.
   */
  public withTextPrompt(prompt: string | dsl.IReference<any>) {
    let reference = null;

    if (typeof prompt === 'string') {
      reference = dsl.reference(dsl.value(prompt));
    } else {
      reference = prompt;
    }

    this.props.text = reference;
    return (this);
  }

  /**
   * @param negativePrompt the negative text prompt to use.
   * @returns the current builder instance.
   */
  public withTextNegativePrompt(negativePrompt: string | dsl.IReference<any>) {
    let reference = null;

    if (typeof negativePrompt === 'string') {
      reference = dsl.reference(dsl.value(negativePrompt));
    } else {
      reference = negativePrompt;
    }

    this.props.negativeText = reference;
    return (this);
  }

  /**
   * @param image sets a reference to the image to use.
   * @returns the current builder instance.
   */
  public withImage(image: dsl.IReference<any>) {
    this.props.image = image;
    return (this);
  }

  /**
   * @param imageGenerationParameters the image generation parameters.
   * @returns the current builder instance.
   */
  public withImageGenerationParameters(imageGenerationParameters: ImageGenerationParameters) {
    this.props.imageGenerationParameters = imageGenerationParameters;
    return (this);
  }

  /**
   * @returns a new instance of the `ImageVariationTask`
   * service constructed with the given parameters.
   */
  public build(): ImageVariationTask {
    return (ImageVariationTask.from(this.props));
  }
}

/**
 * The image variation task.
 */
export class ImageVariationTask {

  /**
   * The `ImageVariationTask` Builder.
   */
  public static readonly Builder = ImageVariationTaskBuilder;

  /**
   * Creates a new instance of the `ImageVariationTask` class.
   * @param props the task properties.
   */
  constructor(public props: ImageVariationProps) {}

  /**
   * @returns the text prompt associated with the task.
   */
  public text() {
    return (this.props.text);
  }

  /**
   * @returns the negative text prompt associated with the task.
   */
  public negativeText() {
    return (this.props.negativeText);
  }

  /**
   * @returns the image prompt associated with the task.
   */
  public image() {
    return (this.props.image);
  }

  /**
   * @returns the image generation parameters.
   */
  public imageGenerationParameters() {
    return (this.props.imageGenerationParameters);
  }

  /**
   * Creates a new instance of the `ImageVariationTask` class.
   * @param props the task properties.
   * @returns a new instance of the `ImageVariationTask` class.
   */
  public static from(props: any) {
    return (new ImageVariationTask(ImageVariationTaskPropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the task.
   */
  public toJSON() {
    return (this.props);
  }
}
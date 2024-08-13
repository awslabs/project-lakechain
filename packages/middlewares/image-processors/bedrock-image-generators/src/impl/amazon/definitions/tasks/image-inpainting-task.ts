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
 * Describes the schema for image inpainting task properties.
 */
const ImageInpaintingTaskPropsSchema = z.object({

  /**
   * A unique identifier for the task.
   */
  taskType: z.literal('INPAINTING'),

  /**
   * The prompt associated with the task.
   */
  text: z
    .custom<dsl.IReference<any>>(),

  /**
   * The negative prompt to use when generating images.
   */
  negativeText: z
    .custom<dsl.IReference<any>>()
    .optional(),

  /**
   * Specifies an initial image to use for the generation.
   * @default uses the current document.
   */
  image: z
    .custom<dsl.IReference<any>>()
    .default(dsl.reference(dsl.document())),

  /**
   * Specifies the mask prompt to use for inpainting generation.
   */
  maskPrompt: z
    .custom<dsl.IReference<any>>()
    .optional(),

  /**
   * Specifies an mask image to use for the generation.
   */
  maskImage: z
    .custom<dsl.IReference<any>>()
    .optional(),

  /**
   * The image generation parameters.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-image.html
   */
  imageGenerationParameters: z.custom<ImageGenerationParameters>()
    .default(new ImageGenerationParameters.Builder().build())
});

// The type of the `ImageInpaintingProps` schema.
export type ImageInpaintingProps = z.infer<typeof ImageInpaintingTaskPropsSchema>;

/**
 * The image inpainting task builder.
 */
export class ImageInpaintingTaskBuilder {

  /**
   * The image inpainting task properties.
   */
  private props: Partial<ImageInpaintingProps> = {
    taskType: 'INPAINTING'
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
   * @param maskPrompt the mask prompt to use.
   * @returns the current builder instance.
   */
  public withMaskPrompt(maskPrompt: string | dsl.IReference<any>) {
    let reference = null;

    if (typeof maskPrompt === 'string') {
      reference = dsl.reference(dsl.value(maskPrompt));
    } else {
      reference = maskPrompt;
    }

    this.props.maskPrompt = reference;
    return (this);
  }

  /**
   * @param maskImage the mask image to use.
   * @returns the current builder instance.
   */
  public withMaskImage(maskImage: dsl.IReference<any>) {
    this.props.maskImage = maskImage;
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
   * @returns a new instance of the `ImageInpaintingTask`
   * service constructed with the given parameters.
   */
  public build(): ImageInpaintingTask {
    return (ImageInpaintingTask.from(this.props));
  }
}

/**
 * The image inpainting task.
 */
export class ImageInpaintingTask {

  /**
   * The `ImageInpaintingTask` Builder.
   */
  public static readonly Builder = ImageInpaintingTaskBuilder;

  /**
   * Creates a new instance of the `ImageInpaintingTask` class.
   * @param props the task properties.
   */
  constructor(public props: ImageInpaintingProps) {
    if (!props.maskImage && !props.maskPrompt) {
      throw new Error('Must specify either mask image or mask prompt.');
    }
    if (props.maskImage && props.maskPrompt) {
      throw new Error('Cannot specify both mask image and mask prompt.');
    }
  }

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
   * @returns the mask prompt associated with the task.
   */
  public maskPrompt() {
    return (this.props.maskPrompt);
  }

  /**
   * @returns the mask image associated with the task.
   */
  public maskImage() {
    return (this.props.maskImage);
  }
  
  /**
   * @returns the image generation parameters.
   */
  public imageGenerationParameters() {
    return (this.props.imageGenerationParameters);
  }

  /**
   * Creates a new instance of the `ImageInpaintingTask` class.
   * @param props the task properties.
   * @returns a new instance of the `ImageInpaintingTask` class.
   */
  public static from(props: any) {
    return (new ImageInpaintingTask(ImageInpaintingTaskPropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the task.
   */
  public toJSON() {
    return (this.props);
  }
}
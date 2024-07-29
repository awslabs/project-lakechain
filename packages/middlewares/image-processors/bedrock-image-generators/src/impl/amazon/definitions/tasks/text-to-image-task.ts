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
 * Describes the schema for a text-to-image task properties.
 */
export const TextToImageTaskPropsSchema = z.object({

  /**
   * A unique identifier for the task.
   */
  taskType: z.literal('TEXT_IMAGE'),

  /**
   * The prompt associated with the task.
   */
  text: z.custom<dsl.IReference<any>>(),

  /**
   * The negative prompt to use when generating images.
   */
  negativeText: z
    .custom<dsl.IReference<any>>()
    .optional(),

  /**
   * The image generation parameters.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-image.html
   */
  imageGenerationParameters: z.custom<ImageGenerationParameters>()
    .optional()
});

// The type of the `TextToImageProps` schema.
export type TextToImageProps = z.infer<typeof TextToImageTaskPropsSchema>;

/**
 * The text-to-image task builder.
 */
export class TextToImageTaskBuilder {

  /**
   * The text-to-image task properties.
   */
  private props: Partial<TextToImageProps> = {
    taskType: 'TEXT_IMAGE'
  };

  /**
   * @param prompt the text prompt to use.
   * @returns the current builder instance.
   */
  public withPrompt(prompt: string | dsl.IReference<any>) {
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
  public withNegativePrompt(negativePrompt: string | dsl.IReference<any>) {
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
   * @param imageGenerationParameters the image generation parameters.
   * @returns the current builder instance.
   */
  public withImageGenerationParameters(imageGenerationParameters: ImageGenerationParameters) {
    this.props.imageGenerationParameters = imageGenerationParameters;
    return (this);
  }

  /**
   * @returns a new instance of the `TextToImageTask`
   * service constructed with the given parameters.
   */
  public build(): TextToImageTask {
    return (TextToImageTask.from(this.props));
  }
}

/**
 * The text-to-image task.
 */
export class TextToImageTask {

  /**
   * The builder constructor.
   */
  public static readonly Builder = TextToImageTaskBuilder;

  /**
   * Creates a new instance of the `TextToImageTask` class.
   * @param props the task properties.
   */
  constructor(public props: TextToImageProps) {}

  /**
   * @returns the prompt associated with the task.
   */
  public prompt() {
    return (this.props.text);
  }

  /**
   * @returns the negative prompt associated with the task.
   */
  public negativePrompt() {
    return (this.props.negativeText);
  }

  /**
   * @returns the image generation parameters.
   */
  public imageGenerationParameters() {
    return (this.props.imageGenerationParameters);
  }

  /**
   * Creates a new instance of the `TextToImageTask` class.
   * @param props the task properties.
   */
  public static from(props: any): TextToImageTask {
    return (new TextToImageTask(TextToImageTaskPropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the task.
   */
  public toJSON() {
    return (this.props);
  }
}
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
 * Describes the schema for the color guided generation task properties.
 */
const ColorGuidedGenerationTaskPropsSchema = z.object({

  /**
   * A unique identifier for the task.
   */
  taskType: z.literal('COLOR_GUIDED_GENERATION'),

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
   * Specifies the reference image.
   * @default uses the current document.
   */
  referenceImage: z
    .custom<dsl.IReference<any>>()
    .optional(),

  /**
   * Specifies an array of colors to use for the generation.
   * @min 1
   * @max 10
   */
  colors: z
    .array(z.string())
    .min(1)
    .max(10),

  /**
   * The image generation parameters.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan-image.html
   */
  imageGenerationParameters: z.custom<ImageGenerationParameters>()
    .default(new ImageGenerationParameters.Builder().build())
});

// The type of the `ColorGuidedGenerationProps` schema.
export type ColorGuidedGenerationProps = z.infer<typeof ColorGuidedGenerationTaskPropsSchema>;

/**
 * The color guided generation task builder.
 */
export class ColorGuidedGenerationTaskBuilder {

  /**
   * The color guided generation task properties.
   */
  private props: Partial<ColorGuidedGenerationProps> = {
    taskType: 'COLOR_GUIDED_GENERATION'
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
   * @param referenceImage sets a reference image to use.
   * @returns the current builder instance.
   */
  public withReferenceImage(referenceImage: dsl.IReference<any>) {
    this.props.referenceImage = referenceImage;
    return (this);
  }

  /**
   * @param colors the colors to use for the generation.
   * @returns the current builder instance.
   */
  public withColors(colors: string[]) {
    this.props.colors = colors;
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
   * @returns a new instance of the `ColorGuidedGenerationTask`
   * service constructed with the given parameters.
   */
  public build(): ColorGuidedGenerationTask {
    return (ColorGuidedGenerationTask.from(this.props));
  }
}

/**
 * The color guided generation task.
 */
export class ColorGuidedGenerationTask {

  /**
   * The `ColorGuidedGenerationTask` Builder.
   */
  public static readonly Builder = ColorGuidedGenerationTaskBuilder;

  /**
   * Creates a new instance of the `ColorGuidedGenerationTask` class.
   * @param props the task properties.
   */
  constructor(public props: ColorGuidedGenerationProps) {}

  /**
   * @returns the text prompt.
   */
  public text() {
    return (this.props.text);
  }

  /**
   * @returns the negative text prompt.
   */
  public negativeText() {
    return (this.props.negativeText);
  }

  /**
   * @returns the reference image.
   */
  public referenceImage() {
    return (this.props.referenceImage);
  }

  /**
   * @returns the colors to use for the generation.
   */
  public colors() {
    return (this.props.colors);
  }

  /**
   * @returns the image generation parameters.
   */
  public imageGenerationParameters() {
    return (this.props.imageGenerationParameters);
  }

  /**
   * Creates a new instance of the `ColorGuidedGenerationTask` class.
   * @param props the task properties.
   * @returns a new instance of the `ColorGuidedGenerationTask` class.
   */
  public static from(props: any) {
    return (new ColorGuidedGenerationTask(ColorGuidedGenerationTaskPropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the task.
   */
  public toJSON() {
    return (this.props);
  }
}
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
 * Describes the schema for the background removal task properties.
 */
const BackgroundRemovalTaskPropsSchema = z.object({

  /**
   * A unique identifier for the task.
   */
  taskType: z.literal('BACKGROUND_REMOVAL'),

  /**
   * Specifies the image to remove the background from.
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
    .default(new ImageGenerationParameters.Builder().build())
});

// The type of the `BackgroundRemovalProps` schema.
export type BackgroundRemovalProps = z.infer<typeof BackgroundRemovalTaskPropsSchema>;

/**
 * The background removal task builder.
 */
export class BackgroundRemovalTaskBuilder {

  /**
   * The background removal task properties.
   */
  private props: Partial<BackgroundRemovalProps> = {
    taskType: 'BACKGROUND_REMOVAL'
  };

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
   * @returns a new instance of the `BackgroundRemovalTask`
   * service constructed with the given parameters.
   */
  public build(): BackgroundRemovalTask {
    return (BackgroundRemovalTask.from(this.props));
  }
}

/**
 * The background removal task.
 */
export class BackgroundRemovalTask {

  /**
   * The `BackgroundRemovalTask` Builder.
   */
  public static readonly Builder = BackgroundRemovalTaskBuilder;

  /**
   * Creates a new instance of the `BackgroundRemovalTask` class.
   * @param props the task properties.
   */
  constructor(public props: BackgroundRemovalProps) {}

  /**
   * @returns the image to remove the background from.
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
   * Creates a new instance of the `BackgroundRemovalTask` class.
   * @param props the task properties.
   * @returns a new instance of the `BackgroundRemovalTask` class.
   */
  public static from(props: any) {
    return (new BackgroundRemovalTask(BackgroundRemovalTaskPropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the task.
   */
  public toJSON() {
    return (this.props);
  }
}
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
 * Describes the schema for extract document task properties.
 */
const ExtractDocumentTaskPropsSchema = z.object({

  /**
   * A unique identifier for the task.
   */
  taskType: z.literal('EXTRACT_DOCUMENT'),

  /**
   * The segmentation task.
   */
  segmentationType: z.literal('document'),

  /**
   * Whether to extract the layout of the pages.
   * @default false
   */
  layoutExtraction: z
    .boolean()
    .optional()
    .default(false),

  /**
   * The output to create.
   */
  outputType: z.union([
    z.literal('text'),
    z.literal('image')
  ])
});

// The type of the `ExtractDocumentTaskProps` schema.
export type ExtractDocumentTaskProps = z.infer<typeof ExtractDocumentTaskPropsSchema>;

/**
 * The image inpainting task builder.
 */
export class ExtractDocumentTaskBuilder {

  /**
   * The image inpainting task properties.
   */
  private props: Partial<ExtractDocumentTaskProps> = {
    taskType: 'EXTRACT_DOCUMENT',
    segmentationType: 'document'
  };

  /**
   * @param outputType the output to create.
   * @returns the current builder instance.
   */
  public withOutputType(outputType: 'text' | 'image') {
    this.props.outputType = outputType;
    return (this);
  }

  /**
   * @param layoutExtraction whether to extract the layout of the pages.
   * @returns the current builder instance.
   */
  public withLayoutExtraction(layoutExtraction: boolean) {
    this.props.layoutExtraction = layoutExtraction;
    return (this);
  }

  /**
   * @returns a new instance of the `ExtractDocumentTask`
   * service constructed with the given parameters.
   */
  public build(): ExtractDocumentTask {
    return (ExtractDocumentTask.from(this.props));
  }
}

/**
 * The extract page task.
 */
export class ExtractDocumentTask {

  /**
   * The `ExtractDocumentTask` Builder.
   */
  public static Builder = ExtractDocumentTaskBuilder;

  /**
   * Creates a new instance of the `ExtractDocumentTask` class.
   * @param props the task properties.
   */
  constructor(public props: ExtractDocumentTaskProps) {}

  /**
   * @returns the task type.
   */
  public taskType() {
    return (this.props.taskType);
  }

  /**
   * @returns the segmentation type.
   */
  public segmentationType() {
    return (this.props.segmentationType);
  }

  /**
   * @returns the output type.
   */
  public outputType() {
    return (this.props.outputType);
  }

  /**
   * @returns whether to extract the layout of the pages.
   */
  public layoutExtraction() {
    return (this.props.layoutExtraction);
  }

  /**
   * Creates a new instance of the `ExtractDocumentTask` class.
   * @param props the task properties.
   * @returns a new instance of the `ExtractDocumentTask` class.
   */
  public static from(props: any) {
    return (new ExtractDocumentTask(ExtractDocumentTaskPropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the task.
   */
  public toJSON() {
    return (this.props);
  }
}
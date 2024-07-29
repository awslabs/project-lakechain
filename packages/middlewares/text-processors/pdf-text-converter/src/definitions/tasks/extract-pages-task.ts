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
 * Describes the schema for extract pages task properties.
 */
const ExtractPagesTaskPropsSchema = z.object({

  /**
   * A unique identifier for the task.
   */
  taskType: z.literal('EXTRACT_PAGES'),

  /**
   * The segmentation task.
   */
  segmentationType: z.literal('page'),

  /**
   * Tne first page to extract.
   */
  firstPage: z
    .number()
    .optional(),

  /**
   * The last page to extract.
   */
  lastPage: z
    .number()
    .optional(),

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
    z.literal('image'),
    z.literal('pdf')
  ])
});

// The type of the `ExtractPagesTaskProps` schema.
export type ExtractPagesTaskProps = z.infer<typeof ExtractPagesTaskPropsSchema>;

/**
 * The image inpainting task builder.
 */
export class ExtractPagesTaskBuilder {

  /**
   * The image inpainting task properties.
   */
  private props: Partial<ExtractPagesTaskProps> = {
    taskType: 'EXTRACT_PAGES',
    segmentationType: 'page'
  };

  /**
   * @param page the first page to extract.
   * @returns the current builder instance.
   */
  public withFirstPage(page: number) {
    this.props.firstPage = page;
    return (this);
  }

  /**
   * @param page the last page to extract.
   * @returns the current builder instance.
   */
  public withLastPage(page: number) {
    this.props.lastPage = page;
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
   * @param outputType the output to create.
   * @returns the current builder instance.
   */
  public withOutputType(outputType: 'text' | 'image' | 'pdf') {
    this.props.outputType = outputType;
    return (this);
  }

  /**
   * @returns a new instance of the `ExtractPagesTask`
   * service constructed with the given parameters.
   */
  public build(): ExtractPagesTask {
    return (ExtractPagesTask.from(this.props));
  }
}

/**
 * The extract page task.
 */
export class ExtractPagesTask {

  /**
   * The `ExtractPagesTask` Builder.
   */
  public static readonly Builder = ExtractPagesTaskBuilder;

  /**
   * Creates a new instance of the `ExtractPagesTask` class.
   * @param props the task properties.
   */
  constructor(public props: ExtractPagesTaskProps) {}

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
   * @returns the first page to extract.
   */
  public firstPage() {
    return (this.props.firstPage);
  }

  /**
   * @returns the last page to extract.
   */
  public lastPage() {
    return (this.props.lastPage);
  }

  /**
   * @returns whether to extract the layout of the pages.
   */
  public layoutExtraction() {
    return (this.props.layoutExtraction);
  }

  /**
   * Creates a new instance of the `ExtractPagesTask` class.
   * @param props the task properties.
   * @returns a new instance of the `ExtractPagesTask` class.
   */
  public static from(props: any) {
    return (new ExtractPagesTask(ExtractPagesTaskPropsSchema.parse(props)));
  }

  /**
   * @returns the JSON representation of the task.
   */
  public toJSON() {
    return (this.props);
  }
}
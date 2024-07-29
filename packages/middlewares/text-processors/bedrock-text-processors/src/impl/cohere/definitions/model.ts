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

/**
 * The Cohere text model properties.
 */
export interface CohereTextModelProps {

  /**
   * The name of the model.
   */
  name: string;

  /**
   * The input mime-types supported by the model.
   */
  inputs: string[];

  /**
   * The output mime-types supported by the model.
   */
  outputs: string[];
}

/**
 * An array of base input mime-types supported
 * by Cohere text models.
 */
export const BASE_TEXT_INPUTS = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'application/x-subrip',
  'text/vtt',
  'application/json',
  'application/xml'
];

/**
 * A helper to select the Cohere text model to use.
 */
export class CohereTextModel {

  /**
   * The name of the model.
   */
  public readonly name: string;

  /**
   * The inputs supported by the model.
   */
  public readonly inputs: string[];

  /**
   * The outputs supported by the model.
   */
  public readonly outputs: string[];

  /**
   * The Bedrock `cohere.command-text-v14` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static readonly COHERE_COMMAND_TEXT_V14 = new CohereTextModel({
    name: 'cohere.command-text-v14',
    inputs: [
      ...BASE_TEXT_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * The Bedrock `cohere.command-light-text-v14` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static readonly COHERE_COMMAND_LIGHT_TEXT_V14 = new CohereTextModel({
    name: 'cohere.command-light-text-v14',
    inputs: [
      ...BASE_TEXT_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * The Bedrock `cohere.command-r-v1:0` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static readonly COHERE_COMMAND_R = new CohereTextModel({
    name: 'cohere.command-r-v1:0',
    inputs: [
      ...BASE_TEXT_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * The Bedrock `cohere.command-r-plus-v1:0` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static readonly COHERE_COMMAND_R_PLUS = new CohereTextModel({
    name: 'cohere.command-r-plus-v1:0',
    inputs: [
      ...BASE_TEXT_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * Create a new instance of the `CohereTextModel`
   * by name.
   * @param props the properties of the model.
   * @returns a new instance of the `CohereTextModel`.
   */
  public static of(props: CohereTextModelProps) {
    return (new CohereTextModel(props));
  }

  constructor(props: CohereTextModelProps) {
    this.name = props.name;
    this.inputs = props.inputs;
    this.outputs = props.outputs;
  }
}

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
 * The Bedrock text model properties.
 */
export interface MistralTextModelProps {

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
 * by Mistral text models.
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
 * A helper to select the Mistral text model to use.
 */
export class MistralTextModel {

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
   * The Bedrock `mistral.mistral-7b-instruct-v0:2` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static MISTRAL_7B_INSTRUCT = new MistralTextModel({
    name: 'mistral.mistral-7b-instruct-v0:2',
    inputs: [
      ...BASE_TEXT_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * The Bedrock `mistral.mixtral-8x7b-instruct-v0:1` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static MIXTRAL_8x7B_INSTRUCT = new MistralTextModel({
    name: 'mistral.mixtral-8x7b-instruct-v0:1',
    inputs: [
      ...BASE_TEXT_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * The Bedrock `mistral.mistral-large-2402-v1:0` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static MISTRAL_LARGE = new MistralTextModel({
    name: 'mistral.mistral-large-2402-v1:0',
    inputs: [
      ...BASE_TEXT_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * Create a new instance of the `MistralTextModel`
   * by name.
   * @param props the properties of the model.
   * @returns a new instance of the `MistralTextModel`.
   */
  public static of(props: MistralTextModelProps) {
    return (new MistralTextModel(props));
  }

  /**
   * Constructs a new instance of the `MistralTextModel`.
   * @param props the properties of the model.
   */
  constructor(props: MistralTextModelProps) {
    this.name = props.name;
    this.inputs = props.inputs;
    this.outputs = props.outputs;
  }
}

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
export interface AnthropicTextModelProps {

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
 * by Anthropic text models.
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
 * An array of base output mime-types supported
 * by Anthropic multimodal models.
 */
export const BASE_IMAGE_INPUTS = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
];

/**
 * The mime-type associated with the aggregate event types.
 */
export const AGGREGATE_EVENT_TYPES = [
  'application/cloudevents+json'
];

/**
 * A helper to select the Anthropic text model to use.
 */
export class AnthropicTextModel {

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
   * The Bedrock `anthropic.claude-instant-v1` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static ANTHROPIC_CLAUDE_INSTANT_V1 = new AnthropicTextModel({
    name: 'anthropic.claude-instant-v1',
    inputs: [
      ...AGGREGATE_EVENT_TYPES,
      ...BASE_TEXT_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * The Bedrock `anthropic.claude-v2` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static ANTHROPIC_CLAUDE_V2 = new AnthropicTextModel({
    name: 'anthropic.claude-v2',
    inputs: [
      ...AGGREGATE_EVENT_TYPES,
      ...BASE_TEXT_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * The Bedrock `anthropic.claude-v2:1` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static ANTHROPIC_CLAUDE_V2_1 = new AnthropicTextModel({
    name: 'anthropic.claude-v2:1',
    inputs: [
      ...AGGREGATE_EVENT_TYPES,
      ...BASE_TEXT_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * The Bedrock `anthropic.claude-3-sonnet-20240229-v1:0` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static ANTHROPIC_CLAUDE_V3_SONNET = new AnthropicTextModel({
    name: 'anthropic.claude-3-sonnet-20240229-v1:0',
    inputs: [
      ...AGGREGATE_EVENT_TYPES,
      ...BASE_IMAGE_INPUTS,
      ...BASE_TEXT_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * The Bedrock `anthropic.claude-3-haiku-20240307-v1:0` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static ANTHROPIC_CLAUDE_V3_HAIKU = new AnthropicTextModel({
    name: 'anthropic.claude-3-haiku-20240307-v1:0',
    inputs: [
      ...AGGREGATE_EVENT_TYPES,
      ...BASE_IMAGE_INPUTS,
      ...BASE_TEXT_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * The Bedrock `anthropic.claude-3-opus-20240229-v1:0` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static ANTHROPIC_CLAUDE_V3_OPUS = new AnthropicTextModel({
    name: 'anthropic.claude-3-opus-20240229-v1:0',
    inputs: [
      ...AGGREGATE_EVENT_TYPES,
      ...BASE_IMAGE_INPUTS,
      ...BASE_TEXT_INPUTS
    ],
    outputs: ['text/plain']
  });

  /**
   * Create a new instance of the `AnthropicTextModel`
   * by name.
   * @param props the properties of the model.
   * @returns a new instance of the `AnthropicTextModel`.
   */
  public static of(props: AnthropicTextModelProps) {
    return (new AnthropicTextModel(props));
  }

  /**
   * Constructs a new instance of the `AnthropicTextModel`.
   * @param props the properties of the model.
   */
  constructor(props: AnthropicTextModelProps) {
    this.name = props.name;
    this.inputs = props.inputs;
    this.outputs = props.outputs;
  }
}

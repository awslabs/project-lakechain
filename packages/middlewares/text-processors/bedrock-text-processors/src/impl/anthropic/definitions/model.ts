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
   * The maximum number of tokens supported by the model.
   */
  maxTokens: number;
}

/**
 * A helper to select the Anthropic text model to use.
 */
export class AnthropicTextModel {

  /**
   * The name of the model.
   */
  public readonly name: string;

  /**
   * The maximum number of tokens supported by the model.
   */
  public readonly maxTokens: number;

  /**
   * The Bedrock `anthropic.claude-v1` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static ANTHROPIC_CLAUDE_V1 = new AnthropicTextModel({
    name: 'anthropic.claude-v1',
    maxTokens: 100_000
  });

  /**
   * The Bedrock `anthropic.claude-v2` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static ANTHROPIC_CLAUDE_V2 = new AnthropicTextModel({
    name: 'anthropic.claude-v2',
    maxTokens: 100_000
  });

  /**
   * The Bedrock `anthropic.claude-v2:1` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static ANTHROPIC_CLAUDE_V2_1 = new AnthropicTextModel({
    name: 'anthropic.claude-v2:1',
    maxTokens: 200_000
  });

  /**
   * The Bedrock `anthropic.claude-instant-v1` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static ANTHROPIC_CLAUDE_INSTANT_V1 = new AnthropicTextModel({
    name: 'anthropic.claude-instant-v1',
    maxTokens: 100_000
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

  constructor(props: AnthropicTextModelProps) {
    this.name = props.name;
    this.maxTokens = props.maxTokens;
  }
}

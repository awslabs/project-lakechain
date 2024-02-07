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
 * The Llama2 text model properties.
 */
export interface Llama2TextModelProps {

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
 * A helper to select the Llama text model to use.
 */
export class Llama2TextModel {

  /**
   * The name of the model.
   */
  public readonly name: string;

  /**
   * The maximum number of tokens supported by the model.
   */
  public readonly maxTokens: number;

  /**
   * The Bedrock `meta.llama2-13b-chat-v1` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static LLAMA2_13B_CHAT_V1 = new Llama2TextModel({
    name: 'meta.llama2-13b-chat-v1',
    maxTokens: 4096
  });

  /**
   * The Bedrock `meta.llama2-70b-chat-v1` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static LLAMA2_70B_CHAT_V1 = new Llama2TextModel({
    name: 'meta.llama2-70b-chat-v1',
    maxTokens: 4096
  });

  /**
   * Create a new instance of the `LlamaTextModel`
   * by name.
   * @param props the properties of the model.
   * @returns a new instance of the `LlamaTextModel`.
   */
  public static of(props: Llama2TextModelProps) {
    return (new Llama2TextModel(props));
  }

  constructor(props: Llama2TextModelProps) {
    this.name = props.name;
    this.maxTokens = props.maxTokens;
  }
}

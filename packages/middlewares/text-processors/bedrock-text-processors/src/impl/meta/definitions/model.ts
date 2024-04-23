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
 * The Llama model properties.
 */
export interface LlamaModelProps {

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
 * A helper to select the Llama model to use.
 */
export class LlamaModel {

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
  public static LLAMA2_13B_CHAT_V1 = new LlamaModel({
    name: 'meta.llama2-13b-chat-v1',
    maxTokens: 4096
  });

  /**
   * The Bedrock `meta.llama2-70b-chat-v1` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static LLAMA2_70B_CHAT_V1 = new LlamaModel({
    name: 'meta.llama2-70b-chat-v1',
    maxTokens: 4096
  });

  /**
   * The Bedrock `meta.llama3-8b-instruct-v1:0` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static LLAMA3_8B_INSTRUCT_V1 = new LlamaModel({
    name: 'meta.llama3-8b-instruct-v1:0',
    maxTokens: 8192
  });

  /**
   * The Bedrock `meta.llama3-70b-instruct-v1:0` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static LLAMA3_70B_INSTRUCT_V1 = new LlamaModel({
    name: 'meta.llama3-70b-instruct-v1:0',
    maxTokens: 8192
  });

  /**
   * Create a new instance of the `LlamaModel`
   * by name.
   * @param props the properties of the model.
   * @returns a new instance of the `LlamaModel`.
   */
  public static of(props: LlamaModelProps) {
    return (new LlamaModel(props));
  }

  constructor(props: LlamaModelProps) {
    this.name = props.name;
    this.maxTokens = props.maxTokens;
  }
}

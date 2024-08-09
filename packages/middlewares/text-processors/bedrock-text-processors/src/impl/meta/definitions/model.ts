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
   * The Bedrock `meta.llama3-8b-instruct-v1:0` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static readonly LLAMA3_8B_INSTRUCT_V1 = new LlamaModel({
    name: 'meta.llama3-8b-instruct-v1:0'
  });

  /**
   * The Bedrock `meta.llama3-70b-instruct-v1:0` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static readonly LLAMA3_70B_INSTRUCT_V1 = new LlamaModel({
    name: 'meta.llama3-70b-instruct-v1:0'
  });

  /**
   * The Bedrock `meta.llama3-1-8b-instruct-v1:0` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static readonly LLAMA3_1_8B_INSTRUCT_V1 = new LlamaModel({
    name: 'meta.llama3-1-8b-instruct-v1:0'
  });

  /**
   * The Bedrock `meta.llama3-1-70b-instruct-v1:0` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static readonly LLAMA3_1_70B_INSTRUCT_V1 = new LlamaModel({
    name: 'meta.llama3-1-70b-instruct-v1:0'
  });

  /**
   * The Bedrock `meta.llama3-1-405b-instruct-v1:0` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static readonly LLAMA3_1_405B_INSTRUCT_V1 = new LlamaModel({
    name: 'meta.llama3-1-405b-instruct-v1:0'
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

  /**
   * Create a new instance of the `LlamaModel`.
   * @param props the properties of the model.
   */
  constructor(props: LlamaModelProps) {
    this.name = props.name;
  }
}

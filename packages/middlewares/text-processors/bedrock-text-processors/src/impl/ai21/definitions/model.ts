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
 * The AI21 text model properties.
 */
export interface AI21TextModelProps {

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
 * A helper to select the AI21 text model to use.
 */
export class AI21TextModel {

  /**
   * The name of the model.
   */
  public readonly name: string;

  /**
   * The maximum number of tokens supported by the model.
   */
  public readonly maxTokens: number;

  /**
   * The Bedrock `ai21.j2-mid-v1` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static AI21_J2_MID_V1 = new AI21TextModel({
    name: 'ai21.j2-mid-v1',
    maxTokens: 8191
  });

  /**
   * The Bedrock `ai21.j2-ultra-v1` model.
   * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids-arns.html
   */
  public static AI21_J2_ULTRA_V1 = new AI21TextModel({
    name: 'ai21.j2-ultra-v1',
    maxTokens: 8191
  });

  /**
   * Create a new instance of the `AI21TextModel`
   * by name.
   * @param props the properties of the model.
   * @returns a new instance of the `AI21TextModel`.
   */
  public static of(props: AI21TextModelProps) {
    return (new AI21TextModel(props));
  }

  constructor(props: AI21TextModelProps) {
    this.name = props.name;
    this.maxTokens = props.maxTokens;
  }
}

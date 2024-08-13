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
 * A helper to select the Titan image model to use.
 */
export class TitanImageModel {

  /**
   * The Bedrock `amazon.titan-image-generator-v1` model.
   * @see https://aws.amazon.com/fr/bedrock/titan/
   */
  public static readonly TITAN_IMAGE_GENERATOR_V1 = new TitanImageModel('amazon.titan-image-generator-v1');

  /**
   * The Bedrock `amazon.titan-image-generator-v2` model.
   * @see https://aws.amazon.com/fr/bedrock/titan/
   */
  public static readonly TITAN_IMAGE_GENERATOR_V2 = new TitanImageModel('amazon.titan-image-generator-v2:0');

  /**
   * Create a new instance of the `TitanImageModel`
   * by name.
   * @param name the name of the model.
   * @returns a new instance of the `TitanImageModel`.
   */
  public static of(name: string) {
    return (new TitanImageModel(name));
  }

  /**
   * `TitanImageModel` constructor.
   * @param name the name of the model.
   */
  constructor(public name: string) {}
}

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
 * A helper to select the SDXL image model to use.
 */
export class SdxlImageModel {

  /**
   * The Bedrock `stability.stable-diffusion-xl-v0` model.
   * @see https://aws.amazon.com/bedrock/stable-diffusion/
   */
  public static STABILITY_DIFFUSION_XL_V0 = new SdxlImageModel('stability.stable-diffusion-xl-v0');

  /**
   * The Bedrock `stability.stable-diffusion-xl-v1` model.
   * @see https://aws.amazon.com/bedrock/stable-diffusion/
   */
  public static STABILITY_DIFFUSION_XL_V1 = new SdxlImageModel('stability.stable-diffusion-xl-v1');

  /**
   * Create a new instance of the `SdxlImageModel`
   * by name.
   * @param name the name of the model.
   * @returns a new instance of the `SdxlImageModel`.
   */
  public static of(name: string) {
    return (new SdxlImageModel(name));
  }

  constructor(public name: string) {}
}

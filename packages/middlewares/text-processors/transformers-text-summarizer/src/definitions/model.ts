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
 * A helper to select a summarization model from
 * the HuggingFace transformers library.
 */
export class SummarizationTransformersModel {

  /**
   * The `facebook/bart-large-cnn` model.
   * @see https://huggingface.co/facebook/bart-large-cnn
   */
  public static BART_LARGE_CNN = new SummarizationTransformersModel(
    'facebook/bart-large-cnn'
  );

  /**
   * The `sshleifer/distilbart-cnn-12-6` model.
   * @see https://huggingface.co/sshleifer/distilbart-cnn-12-6
   */
  public static DISTILBART_CNN_12_6 = new SummarizationTransformersModel(
    'sshleifer/distilbart-cnn-12-6'
  );

  /**
   * The `google/pegasus-cnn_dailymail` model.
   * @see https://huggingface.co/google/pegasus-cnn_dailymail
   */
  public static PEGASUS_CNN_DAILYMAIL = new SummarizationTransformersModel(
    'google/pegasus-cnn_dailymail'
  );

  /**
   * Create a new instance of the `SummarizationTransformersModel`
   * by name.
   * @param name the path of the model on HuggingFace.
   * @returns a new instance of the `SummarizationTransformersModel`.
   */
  public static of(name: string) {
    return (new SummarizationTransformersModel(name));
  }

  constructor(public name: string) {}
}

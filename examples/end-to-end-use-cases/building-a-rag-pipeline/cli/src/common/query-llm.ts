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

import { BedrockRuntime, ResponseStream } from '@aws-sdk/client-bedrock-runtime';

/**
 * @param client The Bedrock client to use to query the large language model.
 * @param prompt The prompt to use to query the large language model.
 * @param question The question to ask the large language model.
 * @param modelId The model to use to query the large language model.
 * @returns a new instance of a configured Bedrock client.
 */
export const queryLlm = async (
  client: BedrockRuntime,
  prompt: string,
  question: string,
  modelId: string
): Promise<AsyncIterable<ResponseStream> | undefined> => {
  const response = await client.invokeModelWithResponseStream({
    body: JSON.stringify({
      prompt: `Human:\n\n${prompt}\n\nAnswer the user question:${question}\n\nAssistant:`,
      max_tokens_to_sample: 4096
    }),
    modelId,
    accept: 'application/json',
    contentType: 'application/json'
  });

  return (response.body);
};
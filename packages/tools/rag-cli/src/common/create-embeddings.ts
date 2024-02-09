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

import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';

/**
 * Creates embeddings for the provided text.
 * @param client the Bedrock client.
 * @param text the text to embed.
 * @returns an array of vector embeddings.
 */
export const createEmbeddings = async (
  client: BedrockRuntime,
  modelId: string,
  text: string
): Promise<Array<number>> => {
  const response = await client.invokeModel({
    body: JSON.stringify({
      inputText: text
    }),
    modelId: modelId,
    accept: 'application/json',
    contentType: 'application/json'
  });

  return (JSON.parse(response.body.transformToString()).embedding);
};
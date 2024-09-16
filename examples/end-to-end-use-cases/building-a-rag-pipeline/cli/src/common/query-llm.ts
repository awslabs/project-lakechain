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

import {
  BedrockRuntime,
  ConverseStreamCommand,
  ConverseStreamCommandOutput,
  Message
} from '@aws-sdk/client-bedrock-runtime';

/**
 * The system prompt to pass with the documents.
 */
const SYSTEM_PROMPT = `
  You are a question answering specialist that has been asked to answer a user question.
  You have access to a set of documents that can help you answer the user question.
  You can use the below information to answer the user question.
`.trim();

/**
 * The prompt to pass with the documents.
 */
const USER_PROMPT = `
  Below are chunks of documents that can answer the request of the user.
  Analyze the below information to answer the user question :
  <question>
  {{ question }}
  </question>
`.trim();

/**
 * Creates the content array to pass to the model.
 * @param question The question to ask the model.
 * @param chunks The chunks to pass to the model.
 * @returns a promise to an array of messages to pass to the model.
 */
const getContent = (question: string, chunks: string[]) => {
  const content = [{
    text: USER_PROMPT.replace('{{ question }}', question)
  }];

  // Add the document to the prompt.
  for (const chunk of chunks) {
    content.push({
      text: `<document>${chunk}</document>`
    });
  }

  return (content);
}

/**
 * @param client The Bedrock client to use to query the large language model.
 * @param chunks The chunks to pass to the large language model.
 * @param question The question to ask the large language model.
 * @param modelId The model to use to query the large language model.
 * @returns a new instance of a configured Bedrock client.
 */
export const queryLlm = async (
  client: BedrockRuntime,
  chunks: string[],
  question: string,
  modelId: string
): Promise<ConverseStreamCommandOutput> => {
  const messages: Message[] = [{
    role: 'user',
    content: getContent(question, chunks)
  }];

  // Invoke the model.
  const response = await client.send(new ConverseStreamCommand({
    system: [{
      text: SYSTEM_PROMPT
    }],
    modelId,
    messages,
    inferenceConfig: {
      maxTokens: 4096
    }
  }));

  if (!response.stream) {
    throw new Error('An error occurred while querying the large language model.');
  }

  return (response);
};
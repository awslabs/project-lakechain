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

import { CloudEvent } from '@project-lakechain/sdk/models';
import { tracer } from '@project-lakechain/sdk/powertools';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';
import { Prompt } from '../../definitions/classifiers/prompt';

import {
  BASE_IMAGE_INPUTS,
  BASE_TEXT_INPUTS
} from '../../definitions/types';

/**
 * Environment variables.
 */
const MODEL_ID = process.env.MODEL_ID;

/**
 * The Bedrock runtime.
 */
const bedrock = tracer.captureAWSv3Client(new BedrockRuntime({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION,
  maxAttempts: 10
}));

/**
 * The response object provided as a response to the invocation.
 */
export interface InvocationResponse {

  /**
   * The transformed data.
   */
  data: any;

  /**
   * The prompt used to generate the data.
   */
  prompt: Prompt;
}

/**
 * Group an array of elements by a given key.
 * @param arr the array to group.
 * @param key the key to group by.
 * @returns a record mapping the given key to the
 * elements of the array.
 */
const groupBy = <T, K extends keyof any>(arr: T[], key: (i: T) => K) =>
  arr.reduce((groups, item) => {
    (groups[key(item)] ||= []).push(item);
    return groups;
  }, {} as Record<K, T[]>
);

/**
 * Computes a list of messages constructed from the input documents.
 * @param event the received event.
 * @returns an array of messages to use for generating text.
 */
const getMessages = async (events: CloudEvent[], prompt: Prompt) => {
  const messages = [{ role: 'user', content: [
    { type: 'text', text: prompt.userPrompt }
  ] as any[] }];

  // Get the input documents.
  events = events.filter((e: CloudEvent) => {
    const type = e.data().document().mimeType();
    return (BASE_TEXT_INPUTS.includes(type) || BASE_IMAGE_INPUTS.includes(type));
  });

  // If no documents match the supported types, throw an error.
  if (events.length === 0) {
    throw new Error('No valid input documents found.');
  }
  
  // Group documents by either `text` or `image` type.
  const group = groupBy(events, e => {
    const type = e.data().document().mimeType();
    return (BASE_TEXT_INPUTS.includes(type) ? 'text' : 'image');
  });

  // Text documents are concatenated into a single message
  // in the case where we're handling a composite event.
  if (group.text) {
    let text = '';

    if (group.text.length > 1) {
      for (const [idx, e] of group.text.entries()) {
        const document = e.data().document();
        text += `Document ${idx + 1}\n${(await document.data().asBuffer()).toString('utf-8')}\n\n`;
      }
    } else {
      const document = group.text[0].data().document();
      text = (await document.data().asBuffer()).toString('utf-8');
    }

    messages[0].content.push({ type: 'text', text });
  }

  // Image documents are added as separate messages.
  if (group.image) {
    for (const e of group.image) {
      const document = e.data().document();
      const type = document.mimeType();

      messages[0].content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: type,
          data: (await document.data().asBuffer()).toString('base64')
        }
      });
    }
  }

  // Prepend the assistant prompt with a `{` character
  // to guide the LLM to generate a JSON object.
  messages.push({ role: 'assistant', content: [
    { type: 'text', text: '{' }
  ] as any[] });
  
  return (messages);
};

/**
 * Constructs the body to pass to the Bedrock API.
 * @param event the cloud event associated with the
 * input document(s).
 * @returns the body to pass to the Bedrock API.
 */
const getBody = async (events: CloudEvent[], prompt: Prompt) => {
  return ({
    anthropic_version: 'bedrock-2023-05-31',
    system: prompt.systemPrompt,
    messages: await getMessages(events, prompt),
    max_tokens: 4096,
    temperature: 0.3
  });
};

/**
 * A helper function used to parse a JSON document
 * embedded within the given string.
 * @param data the string to parse.
 * @returns a JSON object.
 * @throws an error if the JSON document cannot be extracted.
 */
const parseJson = (data: string) => {
  try {
    return (JSON.parse(data));
  } catch (err) {
    // If the document is not a valid JSON, we attempt to extract
    // the JSON object embedded within the string.
    const firstBracket = data.indexOf('{');
    const lastBracket = data.lastIndexOf('}');
    return (JSON.parse(
      data.slice(firstBracket, lastBracket + 1)
    ));
  }
};

/**
 * Transforms the document using the given parameters.
 * @param event the CloudEvent to process.
 * @returns a promise to a buffer containing the transformed document.
 */
export const invoke = async (events: CloudEvent[], prompt: Prompt): Promise<InvocationResponse> => {
  const response = await bedrock.invokeModel({
    body: JSON.stringify(await getBody(events, prompt)),
    modelId: MODEL_ID,
    accept: 'application/json',
    contentType: 'application/json'
  });

  // Parse the response into a buffer.
  const buffer = Buffer.concat([
    Buffer.from('{'),
    Buffer.from(
      JSON.parse(response.body.transformToString()).content[0].text
    )
  ]);

  return ({
    data: parseJson(buffer.toString('utf-8')),
    prompt
  });
};

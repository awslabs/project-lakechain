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

import prompts from 'prompts';
import { OptionValues } from 'commander';

const AWS_REGION_REGEX = /^[a-z]{2}-[a-z]+-\d$/;

/**
 * Prompts the user for the OpenSearch endpoint if not
 * specified as a command-line option.
 * @param opts The command-line options.
 * @returns the OpenSearch endpoint.
 */
export const getOpensearchEndpoint = async (opts: OptionValues) => {
  if (opts.opensearchEndpoint) {
    return (opts.opensearchEndpoint as string);
  }
  const response = await prompts({
    type: 'text',
    name: 'value',
    message: 'What is the OpenSearch endpoint to use to retrieve documents?',
    validate: (value: string) => {
      try {
        new URL(value);
        return (true);
      } catch (err) {
        return ('The OpenSearch endpoint must be a valid URL.');
      }
    }
  });

  if (!response?.value) {
    process.exit(1);
  }
  return (response.value);
};

/**
 * Prompts the user for the question if not
 * specified as a command-line option.
 * @param opts The command-line options.
 * @returns the question.
 */
export const getQuestion = async (opts: OptionValues) => {
  if (opts.question) {
    return (opts.question as string);
  }
  const response = await prompts({
    type: 'text',
    name: 'value',
    message: 'What question would you like to ask your documents?',
    validate: (value: string) => {
      if (value.length < 10) {
        return ('The question must be at least 10 characters long.');
      }
      return (true);
    }
  });

  if (!response?.value) {
    process.exit(1);
  }
  return (response.value);
};

/**
 * Prompts the user for the OpenSearch region if not
 * specified as a command-line option.
 * @param opts The command-line options.
 * @returns the OpenSearch region.
 */
export const getOpenSearchRegion = async (opts: OptionValues) => {
  if (opts.opensearchRegion) {
    return (opts.opensearchRegion as string);
  }
  const response = await prompts({
    type: 'text',
    name: 'value',
    message: 'What is the AWS region in which OpenSearch is deployed (e.g us-east-1) ?',
    validate: (value: string) => {
      if (!value.match(AWS_REGION_REGEX)) {
        return ('The AWS region must be in the format: us-east-1');
      }
      return (true);
    }
  });

  if (!response?.value) {
    process.exit(1);
  }
  return (response.value);
};

/**
 * Prompts the user for the Bedrock region if not
 * specified as a command-line option.
 * @param opts The command-line options.
 * @returns the Bedrock region.
 */
export const getBedrockRegion = async (opts: OptionValues) => {
  if (opts.bedrockRegion) {
    return (opts.bedrockRegion as string);
  }
  const response = await prompts({
    type: 'text',
    name: 'value',
    message: 'What is the AWS region in which Bedrock is deployed (e.g us-east-1) ?',
    validate: (value: string) => {
      if (!value.match(AWS_REGION_REGEX)) {
        return ('The AWS region must be in the format: us-east-1');
      }
      return (true);
    }
  });

  if (!response?.value) {
    process.exit(1);
  }
  return (response.value);
};
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

import ora from 'ora';
import figlet from 'figlet';

import { z } from 'zod';
import { parseSchema } from './common/parse-schema.js';
import { program } from 'commander';
import { createOpenSearchClient } from './common/opensearch-client.js';
import { createBedrockClient } from './common/bedrock-client.js';
import { createEmbeddings } from './common/create-embeddings.js';
import { findSimilarDocuments } from './common/find-similar-documents.js';
import { queryLlm } from './common/query-llm.js';

import {
  getOpensearchEndpoint,
  getQuestion,
  getOpenSearchRegion,
  getBedrockRegion
} from './common/prompts.js';

/**
 * Command-line interface.
 */
program
  .name('rag')
  .description('Performs Retrieval Augmented Generation using Amazon OpenSearch and Amazon Bedrock.')
  .option('-q, --question <question>', 'The question to ask the large language model.')
  .option('-e, --opensearch-endpoint <opensearch-endpoint>', 'The OpenSearch endpoint to use to retrieve documents.')
  .option('-i, --index-name <index-name>', '(Optional) The index name to use to retrieve documents.')
  .option('-r, --opensearch-region <opensearch-region>', '(Optional) The AWS region in which OpenSearch is deployed.')
  .option('-b, --bedrock-region <bedrock-region>', '(Optional) The AWS region in which Bedrock is deployed. Defaults to us-east-1.')
  .option('-k, --number-of-similar-documents <number-of-similar-documents>', '(Optional) The number of similar documents to retrieve.')
  .option('-m, --model-id <model-id>', '(Optional) The model ID to use to query the large language model.')
  .parse(process.argv);

/**
 * The schema used to validate the command-line options.
 */
const OptionsSchema = z.object({
  question: z
    .string()
    .min(10)
    .optional(),
  opensearchEndpoint: z
    .string()
    .url()
    .optional(),
  indexName: z
    .string()
    .default('text-vectors')
    .optional(),
  opensearchRegion: z
    .string()
    .optional(),
  bedrockRegion: z
    .string()
    .default('us-east-1'),
  modelId: z
    .string()
    .default('anthropic.claude-3-sonnet-20240229-v1:0'),
  numberOfSimilarDocuments: z
    .number()
    .min(1)
    .max(20)
    .optional()
});

/**
 *   ____      _    ____
 * |  _ \    / \  / ___|
 * | |_) |  / _ \| |  _
 * |  _ <  / ___ \ |_| |
 * |_| \_\/_/   \_\____|
 *
 */
console.log(`\n${figlet.textSync('RAG', {
  font: 'Standard',
  horizontalLayout: 'default',
  verticalLayout: 'default'
})}\n`);

// User options.
let options = program.opts();

// Validate the options.
try {
  options = parseSchema(OptionsSchema, options);
} catch (err) {
  console.error(err);
  process.exit(1);
}

/**
 * The below function orchestrates the different retrieval
 * steps required to answer the question. That is:
 * 1. Test whether the application has access to OpenSearch.
 * 2. Create embeddings for the question using Amazon Bedrock.
 * 3. Find the most similar documents to the question using Amazon OpenSearch.
 * 4. Create the prompt to pass to the large language model.
 * 5. Query the large language model.
 * 6. Display the response in streaming.
 *
 * @note we have purposefully written the below logic manually
 * to clearly highlight the different steps involved in the retrieval process.
 */
(async () => {
  const endpoint = await getOpensearchEndpoint(options);
  const question = await getQuestion(options);
  const opensearchRegion = await getOpenSearchRegion(options);
  const bedrockRegion = await getBedrockRegion(options);
  const opensearch = createOpenSearchClient(endpoint, opensearchRegion);
  const bedrock = createBedrockClient(bedrockRegion);

  /**
   * Connection test to OpenSearch.
   */
  let spinner = ora('Testing connection to OpenSearch...').start();
  try {
    await opensearch.info();
    spinner.succeed('Connection to OpenSearch successful.');
  } catch (err: any) {
    spinner.fail(`Connection to OpenSearch failed: ${err.message}`);
    process.exit(1);
  }


  /**
   * Creating embeddings for the question that will be used
   * to find the most similar documents to the question.
   */
  let embeddings = null;
  spinner = ora('Creating embeddings for the question...').start();
  try {
    embeddings = await createEmbeddings(bedrock, question);
    spinner.succeed('Embeddings created.');
  } catch (err: any) {
    spinner.fail(`Embeddings creation failed: ${err.message}`);
    process.exit(1);
  }


  /**
   * Finding the most similar documents to the question.
   */
  let hits = null;
  try {
    spinner = ora('Finding the most similar documents to the question...').start();
    hits = await findSimilarDocuments(
      opensearch,
      options.indexName,
      embeddings,
      question,
      options.numberOfSimilarDocuments
    );
    spinner.succeed('Most similar documents retrieved.');
  } catch (err: any) {
    spinner.fail(`Most similar documents retrieval failed: ${err.message}`);
    process.exit(1);
  }

  /**
   * Querying the large language model using the created prompt,
   * and the user question.
   */
  let events = null;
  try {
    const prompts = hits.map((hit: any) => hit._source.text);
    spinner = ora('Querying the LLM...').start();
    events = await queryLlm(
      bedrock,
      prompts,
      question,
      options.modelId
    );
    spinner.succeed('Stream created.');
  } catch (err: any) {
    spinner.fail(`Querying the LLM failed: ${err.message}`);
    process.exit(1);
  }

  /**
   * Displaying the response in streaming.
   */
  console.log();
  for await (const event of events.stream!) {
    if (event.contentBlockDelta?.delta?.text) {
      process.stdout.write(event.contentBlockDelta.delta.text);
    }
  }
})();

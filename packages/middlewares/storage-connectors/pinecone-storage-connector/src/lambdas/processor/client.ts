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

import { getSecret } from '@aws-lambda-powertools/parameters/secrets';
import { Pinecone } from '@pinecone-database/pinecone';

/**
 * Environment variables.
 */
const API_KEY_SECRET_NAME: string = process.env.API_KEY_SECRET_NAME as string;
const PINECONE_INDEX_NAME: string = process.env.PINECONE_INDEX_NAME as string;
const PINECONE_NAMESPACE: string = process.env.PINECONE_NAMESPACE as string;
const PINECONE_CONTROLLER_HOST_URL: string = process.env.PINECONE_CONTROLLER_HOST_URL as string;

/**
 * @param maxAge the maximum amount of time in seconds
 * the secret can be cached (180 seconds by default).
 * @returns a new instance of the Pinecone client
 * configured with the API key retrieved from
 * AWS Secrets Manager.
 */
export const createClient = async (maxAge = 180) => {
  const apiKey = await getSecret(API_KEY_SECRET_NAME, { maxAge }) as string;

  if (!apiKey) {
    throw new Error(`Missing the API key secret named ${API_KEY_SECRET_NAME}.`);
  }

  // Creating a new Pinecone client.
  let pinecone = new Pinecone({
    apiKey,
    controllerHostUrl: PINECONE_CONTROLLER_HOST_URL
  }).index(PINECONE_INDEX_NAME);

  // Setting the namespace if provided.
  if (PINECONE_NAMESPACE) {
    pinecone = pinecone.namespace(PINECONE_NAMESPACE);
  }

  return (pinecone);
};
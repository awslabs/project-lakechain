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
import { driver, auth, Driver } from 'neo4j-driver';

/**
 * Environment variables.
 */
const SECRET_NAME: string = process.env.NEO4J_CREDENTIALS_SECRET_NAME as string;
const NEO4J_URI: string = process.env.NEO4J_URI as string;

/**
 * @param maxAge the maximum amount of time in seconds
 * the secret can be cached (180 seconds by default).
 * @returns a new instance of the Pinecone client
 * configured with the API key retrieved from
 * AWS Secrets Manager.
 */
export const createClient = async (maxAge = 180): Promise<Driver> => {
  const credentials = JSON.parse(
    await getSecret(SECRET_NAME, { maxAge }) as string
  );

  return (driver(
    NEO4J_URI,
    auth.basic(credentials.USERNAME, credentials.PASSWORD)
  ));
};
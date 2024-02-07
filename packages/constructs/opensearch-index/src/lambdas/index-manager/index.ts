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

import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { ServiceIdentifier } from '../../definitions/service-identifier';

/**
 * The index name.
 */
const INDEX_NAME = process.env.OPENSEARCH_INDEX_NAME as string;

/**
 * The OpenSearch endpoint.
 */
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT as string;

/**
 * The index body attributes.
 */
const BODY_PARAMETERS = JSON.parse(process.env.BODY_PARAMETERS as string);

/**
 * The OpenSearch service identifier.
 */
const SERVICE_IDENTIFIER = process.env.SERVICE_IDENTIFIER as ServiceIdentifier;

/**
 * The OpenSearch client.
 */
const client = new Client({
  ...AwsSigv4Signer({
    region: process.env.AWS_REGION!,
    service: SERVICE_IDENTIFIER,
    getCredentials: () => {
      const credentialsProvider = defaultProvider();
      return credentialsProvider();
    }
  }),
  node: OPENSEARCH_ENDPOINT
});

/**
 * Creates the index associated with the given event.
 * @returns the response to the custom resource event
 * @throws if an error occurs
 */
const onCreate = async () => {
  try {
    await client.indices.create({
      index: INDEX_NAME,
      body: BODY_PARAMETERS
    });
  } catch (error: any) {
    // We don't catch index already exists errors.
    if (error.meta?.body?.error?.type !== 'resource_already_exists_exception') {
      throw error;
    }
  }

  return {
    PhysicalResourceId: INDEX_NAME
  };
};

/**
 * Deletes the index associated with the given event.
 * @returns the response to the custom resource event
 * @throws if an error occurs
 */
const onDelete = async () => {
  try {
    await client.indices.delete({ index: INDEX_NAME });
  } catch (error: any) {
    // The index might not exist anymore.
    if (error.statusCode !== 404) {
      throw error;
    }
  }

  return {
    PhysicalResourceId: INDEX_NAME
  };
};

/**
 * The custom resource entry point.
 * @param event the CloudFormation custom resource event
 * @returns the response to the custom resource event
 */
export const handler = (event: any) => {
  if (event.RequestType === 'Create') {
    return (onCreate());
  } else if (event.RequestType === 'Delete') {
    return (onDelete());
  }

  return {
    PhysicalResourceId: INDEX_NAME
  };
};

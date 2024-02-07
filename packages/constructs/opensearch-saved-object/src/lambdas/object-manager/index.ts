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

/**
 * The OpenSearch client.
 */
const client = new Client({
  ...AwsSigv4Signer({
    region: process.env.AWS_REGION!,
    service: 'es',
    getCredentials: () => {
      const credentialsProvider = defaultProvider();
      return credentialsProvider();
    }
  }),
  node: process.env.OPENSEARCH_DOMAIN
});

/**
 * Creates a multipart/form-data file from the given object.
 * @param obj the object to wrap as a multipart/form-data file
 * @returns a string representing the multipart/form-data file
 */
const asFile = (obj: any) => {
  const boundary = `----WebKitFormBoundary${Date.now().toString(16)}`;
  let data = `--${boundary}\r\n`;

  data += 'Content-Disposition: form-data; name="file"; filename="a.ndjson"\r\n';
  data += 'Content-Type: application/ndjson\r\n\r\n';
  data += `${obj}\r\n`;
  data += `--${boundary}--`;

  return ({ file: data, boundary });
};

/**
 * Creates the index associated with the given event.
 * @param event the CloudFormation custom resource event
 * @returns the response to the custom resource event
 * @throws if an error occurs
 */
const onCreate = async (event: any) => {
  const { SavedObject } = event.ResourceProperties;
  const { file, boundary } = asFile(SavedObject.data);

  // Upload the saved object.
  await client.transport.request({
    method: 'POST',
    path: '_dashboards/api/saved_objects/_import?overwrite=true',
    body: file
  }, {
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'osd-xsrf': 'true'
    }
  });

  return {
    PhysicalResourceId: SavedObject.name
  };
};

/**
 * The custom resource entry point.
 * @param event the CloudFormation custom resource event
 * @returns the response to the custom resource event
 */
export const handler = (event: any) => {
  const { SavedObject } = event.ResourceProperties;

  if (event.RequestType === 'Create') {
    return (onCreate(event));
  }

  return {
    PhysicalResourceId: SavedObject.name
  };
};

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

import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';

/**
 * Neo4j Storage Connector properties schema.
 */
export const Neo4jStorageConnectorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The URI for the Neo4j API.
   */
  uri: z
    .string()
    .url(),

  /**
   * The credentials to use for the Neo4j API.
   */
  credentials: z.custom<secrets.ISecret>((value) => {
    return (value instanceof Object);
  }, {
    message: 'Credentials are required by the Neo4j Data Store.'
  })
});

// The type of the Neo4jStorageConnectorProps schema.
export type Neo4jStorageConnectorProps = z.infer<typeof Neo4jStorageConnectorPropsSchema>;

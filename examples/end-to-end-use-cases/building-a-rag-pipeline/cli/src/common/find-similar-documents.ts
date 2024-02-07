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

import { Client } from '@opensearch-project/opensearch';

/**
 * Issues a query to OpenSearch to retrieve the most similar
 * documents to the provided embeddings.
 * @param client the OpenSearch client.
 * @param indexName the name of the index to query.
 * @param embeddings the embeddings to use to find similar documents.
 * @param k the number of similar documents to retrieve.
 * @returns an array of similar documents.
 */
export const findSimilarDocuments = async (
  client: Client,
  indexName: string,
  embeddings: Array<number>,
  k = 5
): Promise<Array<any>> => {
  const { body } = await client.search({
    index: indexName,
    body: {
      query: {
        bool: {
          must: [{
            knn: {
              embeddings: {
                vector: embeddings,
                k
              }
            }
          }]
        }
      },
      size: k
    }
  });

  return (body.hits.hits);
};
#  Copyright (C) 2023 Amazon.com, Inc. or its affiliates.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

from embeddings.image_embeddings import clip_create_text_embeddings
from embeddings.text_embeddings import bedrock_create_text_embeddings
from boto3 import Session
from params import bedrock_region

from opensearchpy import (
  AWSV4SignerAuth,
  OpenSearch,
  RequestsHttpConnection
)

def create_opensearch_client(
  endpoint: str,
  region_name: str,
  port: int = 443
):
  """
  Creates an OpenSearch client.
  :param endpoint: The OpenSearch endpoint.
  :param region_name: The OpenSearch region name.
  :param port: The OpenSearch port.
  :return: The OpenSearch client.
  """
  credentials = Session().get_credentials()
  auth = AWSV4SignerAuth(credentials, region_name)

  # Create the OpenSearch client.
  return OpenSearch(
    hosts = [{
      'host': endpoint,
      'port': port
    }],
    http_auth=auth,
    http_compress = True,
    use_ssl = True,
    verify_certs = True,
    connection_class=RequestsHttpConnection
  )


def image_semantic_search(
  client: OpenSearch,
  search: str,
  top: int = 20,
  k: int = 5
):
  """
  Performs a semantic search for images given the search text.
  :param client: The OpenSearch client.
  :param search: The text to search for.
  :param top: The number of results to return.
  :param k: The number of nearest neighbors to retrieve.
  :return: The results of the semantic search.
  """
  # Create embeddings for the query.
  embeddings = clip_create_text_embeddings(search)

  # Perform the semantic search.
  result = client.search(
    index = 'image-vectors',
    body = {
        'query': {
          'bool': {
            'must': {
              'knn': {
                'embeddings': {
                  'vector': embeddings,
                  'k': k
                }
              }
            }
          }
        },
        '_source': ['data'],
        'size': top
      }
  )
  return result['hits']['hits']


def text_semantic_search(
  client: OpenSearch,
  search: str,
  top: int = 30,
  k: int = 5
):
  """
  Performs a semantic search for the given text.
  :param client: The OpenSearch client.
  :param search: The text to search for.
  :param top: The number of results to return.
  :param k: The number of nearest neighbors to retrieve.
  :return: The results of the semantic search.
  """
  # Create embeddings for the query.
  embeddings = bedrock_create_text_embeddings(text=search, region_name=bedrock_region)

  # Perform the semantic search.
  result = client.search(
    index = 'text-vectors',
    body = {
      'query': {
        'bool': {
          'must': [{
            'knn': {
              'embeddings': {
                'vector': embeddings,
                'k': k
              }
            }
          }]
        }
      },
      '_source': ['data'],
      'size': top
    }
  )

  # Group the results by document.
  documents = {}
  for hit in result['hits']['hits']:
    source = hit['_source']['data']['source']
    if source['url'] not in documents:
      documents[source['url']] = {
        'document': hit['_source']['data']['document'],
        'metadata': hit['_source']['data']['metadata'],
        'source': source,
        'score': hit['_score']
      }
    else:
      documents[source['url']]['score'] += hit['_score']

  # Sort the documents by score.
  return sorted(documents.values(), key=lambda x: x['score'], reverse=True)


def delete_documents(client: OpenSearch):
  """
  Deletes all documents from the document index.
  """
  return client.delete_by_query(
    index='text-vectors',
    body={
      'query': {
        'match_all': {}
      }
    }
  )


def delete_images(client: OpenSearch):
  """
  Deletes all documents from the image index.
  """
  return client.delete_by_query(
    index='image-vectors',
    body={
      'query': {
        'match_all': {}
      }
    }
  )

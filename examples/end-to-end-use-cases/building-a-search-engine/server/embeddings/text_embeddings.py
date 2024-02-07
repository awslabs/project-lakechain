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

import json
import boto3

def bedrock_create_text_embeddings(
  text: str,
  region_name: str = 'us-east-1'
):
  """
  Generates text embeddings for the given text.
  :param text: The text for which to generate embeddings.
  :param region_name: The AWS region name for Amazon Bedrock.
  :return: The text embeddings for the given text.
  """
  # The Bedrock client.
  bedrock = boto3.client(
    service_name='bedrock-runtime',
    region_name=region_name
  )

  response = bedrock.invoke_model(
    body=json.dumps({
      'texts': [text],
      'input_type': 'search_query'
    }),
    modelId='cohere.embed-multilingual-v3',
    accept='application/json',
    contentType='application/json'
  )
  res = json.loads(response.get('body').read())
  return res['embeddings'][0]

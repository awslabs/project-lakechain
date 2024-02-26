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

import os
import boto3
import ollama
import time

from urllib.parse import urlparse, unquote
from filelock import FileLock

# Environment variables.
model  = os.getenv('OLLAMA_MODEL')
prompt = os.getenv('OLLAMA_PROMPT')
cache  = os.getenv('OLLAMA_MODELS', '/tmp')

def load_document(url: str) -> bytes:
  """
  Loads the document from the given `url` in memory.
  :param url: The URL of the document to load.
  :return: The document bytes.
  """
  s3_client  = boto3.client('s3')
  parsed_url = urlparse(url)
  bucket     = unquote(parsed_url.netloc)
  key        = unquote(parsed_url.path).lstrip('/')
  response   = s3_client.get_object(Bucket=bucket, Key=key)
  return response['Body'].read()


def exists(model):
  """
  Checks if an ollama model exists in the cache.
  :param model: The name of the model to check.
  :return: True if the model exists, False otherwise.
  """
  try:
    ollama.show(model)
    return True
  except:
    return False


def pull(model: str):
  """
  Pulls the given model locally.
  This function will create a distributed lock on the network
  filesystem to ensure that only one process can pull the model
  at a time.
  :param model: The name of the model to pull.
  """
  lock = FileLock(os.path.join(cache, f'{model}.lock'))
  
  print(f'Created lock for model {model}.lock, waiting for lock ...')
  with lock.acquire(timeout=30):
    print('Acquired lock, pulling model ...')
    previous_ms = 0
    for progress in ollama.pull(model, stream=True):
      digest = progress.get('digest', '')

      if not digest:
        print(progress.get('status'))
        continue

      # Display progress every 5 seconds.
      current_ms = round(time.time() * 1000)
      if current_ms - previous_ms > 5000:
        total = progress.get('total', 0)
        completed = progress.get('completed', 0)
        percent = completed / total * 100
        previous_ms = current_ms
        print(f'Progress: {percent:.2f}%')


def process(content: bytes, document: dict) -> dict:
  """
  Processes the given document content using the ollama model.
  :param content: The content to process.
  :param document: The document information.
  :return: The processed content.
  """
  if not exists(model):
    try:
      print(f'Model {model} does not exist, pulling ...')
      pull(model)
    except Exception as e:
      raise ValueError(f"Failed to pull model {model}: {e}")
  
  # Text document.
  if document['type'] == 'text/plain':
    return ollama.generate(
      model,
      system=prompt,
      prompt=content.decode('utf-8'),
      context=[]
    )
  
  # Image document.
  if document['type'].startswith('image/'):
    return ollama.generate(
      model,
      prompt=prompt,
      images=[content],
      context=[],
    )
  
  raise ValueError(f"Unsupported document type: {document['type']}")


def transform_document(document: dict) -> dict:
  """
  Transforms the given document by loading its content from the
  provided URL and processing it using the ollama model.
  :param document: The document to transform.
  :return: The transformed document.
  """
  content = load_document(document['url'])

  # Process the document using the ollama model.
  return process(content, document)['response']

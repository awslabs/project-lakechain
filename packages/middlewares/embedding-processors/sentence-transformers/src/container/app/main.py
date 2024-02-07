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
import json
import boto3
import traceback
import torch
import logging

from publish import publish_event
from urllib.parse import urlparse, unquote
from sentence_transformers import SentenceTransformer
from message_provider import sqs_consume_queue

# Configure the logger for the application.
logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s - %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

# The device used for inference.
device = 'cuda' if torch.cuda.is_available() else \
         ('mps' if torch.backends.mps.is_available() else 'cpu')

# Environment variables.
SERVICE_NAME    = os.getenv('POWERTOOLS_SERVICE_NAME')
INPUT_QUEUE_URL = os.getenv('INPUT_QUEUE_URL')
CACHE_BUCKET    = os.getenv('LAKECHAIN_CACHE_STORAGE')
CACHE_DIR       = os.getenv('CACHE_DIR')
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'all-mpnet-base-v2')

# Load the sentence transformer model.
model = SentenceTransformer(
  EMBEDDING_MODEL,
  device=device,
  cache_folder=CACHE_DIR
)

def merge(dct, merge_dct):
  """ Recursive dict merge. Inspired by :meth:``dict.update()``, instead of
  updating only top-level keys, dict_merge recurses down into dicts nested
  to an arbitrary depth, updating keys. The ``merge_dct`` is merged into
  ``dct``.
  :param dct: dict onto which the merge is executed
  :param merge_dct: dct merged into dct
  :return: None
  """
  for k, v in merge_dct.items():
    if (k in dct and isinstance(dct[k], dict) and isinstance(merge_dct[k], dict)):
      merge(dct[k], merge_dct[k])
    else:
      dct[k] = merge_dct[k]


def load_document(url: str) -> str:
  """
  Loads the document from the given `url` in memory.
  :param url: The URL of the document to load.
  :return: The content of the document as UTF-8 encoded string.
  """
  s3_client  = boto3.client('s3')
  parsed_url = urlparse(url)
  bucket     = unquote(parsed_url.netloc)
  key        = unquote(parsed_url.path).lstrip('/')
  response   = s3_client.get_object(Bucket=bucket, Key=key)
  return response['Body'].read().decode('utf-8')


def create_embeddings(data) -> list:
  """
  :param data: The data to process.
  :return: The embeddings for the given data.
  """
  return model.encode(
    data,
    device=device,
    convert_to_tensor=True,
    show_progress_bar=False
  ).tolist()


def get_embeddings_from_event(event: dict):
  """
  Creates embeddings for the document associated
  with the given event.
  The embeddings will be referenced in the event metadata.
  :param event: The event to process.
  """
  s3_client = boto3.client('s3')
  document  = event['data']['document']
  url       = document['url']
  etag      = document['etag']
  dest      = f"{SERVICE_NAME}/{etag}"
  metadata  = event['data']['metadata']
  
  # Load the document in memory.
  data = load_document(url)
  
  # Create the embeddings.
  embeddings = create_embeddings([data])
    
  # Upload the data payload to S3.
  s3_client.put_object(
    Body=json.dumps(embeddings[0]),
    Bucket=CACHE_BUCKET,
    Key=dest
  )

  # Update the metadata.
  merge(metadata, {
    'properties': {
      'kind': 'text',
      'attrs': {
        'embeddings': {
          'vectors': f"s3://{CACHE_BUCKET}/{dest}",
          'model': EMBEDDING_MODEL,
          'dimensions': len(embeddings[0])
        }
      }
    }
  })
  
  return event


def on_message(message: dict):
  """
  Worker function processing a message and
  publishing the result on the output SNS topic
  to the next middlewares.
  
  When successfully processed, the message is also
  deleted from the originating SQS queue.
  :param message: The message to process.
  """
  try:
    sqs_client = boto3.client('sqs')
    event      = json.loads(message['Body'])
    
    # Generate the embeddings for the document.
    publish_event(get_embeddings_from_event(event))
    
    # Deleting the message from the queue.
    sqs_client.delete_message(
      QueueUrl=INPUT_QUEUE_URL,
      ReceiptHandle=message['ReceiptHandle']
    )
  except Exception:
    traceback.print_exc()


#
# Main entry point.
#
if __name__ == "__main__":
  sqs_consume_queue(
    queue_url=INPUT_QUEUE_URL,
    message_processor=on_message
  )

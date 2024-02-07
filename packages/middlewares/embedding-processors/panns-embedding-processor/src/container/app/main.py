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
import logging
import io
import torch
import pydub

logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s - %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

from urllib.parse import urlparse, unquote
from publish import publish_event
from message_provider import sqs_consume_queue
from embeddings import create_embeddings

# Environment variables.
SERVICE_NAME    = os.getenv('POWERTOOLS_SERVICE_NAME')
INPUT_QUEUE_URL = os.getenv('INPUT_QUEUE_URL')
CACHE_BUCKET    = os.getenv('LAKECHAIN_CACHE_STORAGE')

# The device used for inference.
device = 'cuda' if torch.cuda.is_available() else \
         ('mps' if torch.backends.mps.is_available() else 'cpu')

def merge(dct, merge_dct):
  """ Recursive dict merge. Inspired by :meth:``dict.update()``, instead of
  updating only top-level keys, dict_merge recurses down into dicts nested
  to an arbitrary depth, updating keys. The ``merge_dct`` is merged into
  ``dct``.
  :param dct: dict onto which the merge is executed
  :param merge_dct: dct merged into dct
  :return: None
  """
  for k, _ in merge_dct.items():
    if (k in dct and isinstance(dct[k], dict) and isinstance(merge_dct[k], dict)):
      merge(dct[k], merge_dct[k])
    else:
      dct[k] = merge_dct[k]


def load_document(url: str) -> io.BytesIO:
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
  return io.BytesIO(response['Body'].read())


def convert_to_wav(audio: io.BytesIO) -> io.BytesIO:
  """
  Converts the given audio file to WAV format.
  :param audio: The audio byte stream.
  :return: The audio bytes in WAV format.
  """
  bytes = io.BytesIO()
  pydub.AudioSegment.from_file(audio).export(bytes, 'wav')
  return bytes


def process_event(event: dict):
  """
  Processes the event and generates the embeddings
  for the given audio document.
  :param event: The event to process.
  """
  s3_client  = boto3.client('s3')
  document   = event['data']['document']
  url        = document['url']
  etag       = document['etag']
  dest       = f"{SERVICE_NAME}/{etag}"
  metadata   = event['data']['metadata']
  
  # Load the audio in memory.
  image = load_document(url)
  
  # Generate embeddings for the audio.
  audio_embeddings = create_embeddings(
    audio=convert_to_wav(image)
  )

  # Upload the data payload to S3.
  s3_client.put_object(
    Body=json.dumps(audio_embeddings),
    Bucket=CACHE_BUCKET,
    Key=dest
  )
      
  # Update the metadata.
  merge(metadata, {
    'properties': {
      'kind': 'audio',
      'attrs': {
        'embeddings': {
          'vectors': f"s3://{CACHE_BUCKET}/{dest}",
          'model': 'panns_inference',
          'dimensions': len(audio_embeddings)
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
    publish_event(process_event(event))
    
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

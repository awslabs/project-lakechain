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
import io
import json
import boto3
import traceback
import logging

from PIL import Image
from publish import publish_event
from urllib.parse import urlparse, unquote
from message_provider import sqs_consume_queue
from metadata import get_metadata_from_image

# Configure the logger for the application.
logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s - %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

# Environment variables.
INPUT_QUEUE_URL = os.environ.get('INPUT_QUEUE_URL')

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


def load_image(url: str) -> Image:
  """
  Loads the image from the S3 bucket in memory.
  :param url: The URL of the document in the S3 bucket.
  """
  s3_client  = boto3.client('s3')
  parsed_url = urlparse(url)
  bucket     = unquote(parsed_url.netloc)
  key        = unquote(parsed_url.path).lstrip('/')
  response   = s3_client.get_object(Bucket=bucket, Key=key)
  content    = response['Body'].read()
  return Image.open(io.BytesIO(content)).convert('RGB')


def get_metadata_with_description(event: dict) -> dict:
  """
  Generates a description for the image associated
  with the given CloudEvent, and stores it in the
  document metadata.
  :param event: The event to process.
  :returns: the updated event.
  """
  data     = event['data']
  url      = data['document']['url']
  metadata = data['metadata']
  
  # Load the image in memory.
  image = load_image(url)
  
  # Update the metadata.
  merge(metadata, get_metadata_from_image(event, image))
  
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
    
    # Publish the event to the next middlewares.
    publish_event(get_metadata_with_description(event))
    
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

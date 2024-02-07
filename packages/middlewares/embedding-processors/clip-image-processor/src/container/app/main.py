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

logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s - %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

from PIL import Image
from urllib.parse import urlparse, unquote
from publish import publish_event
from message_provider import sqs_consume_queue
from embeddings import create_image_embeddings, get_top_labels

# Environment variables.
SERVICE_NAME    = os.getenv('POWERTOOLS_SERVICE_NAME')
INPUT_QUEUE_URL = os.getenv('INPUT_QUEUE_URL')
CACHE_BUCKET    = os.getenv('LAKECHAIN_CACHE_STORAGE')
EXTRACT_LABELS  = os.getenv('EXTRACT_LABELS', 'true').lower() == 'true'
CLIP_MODEL      = os.getenv('CLIP_MODEL', 'ViT-B/32')

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
  Loads the image from the given `url` in memory.
  :param url: The URL of the image to process.
  :return: The image loaded in memory.
  """
  s3_client  = boto3.client('s3')
  parsed_url = urlparse(url)
  bucket     = unquote(parsed_url.netloc)
  key        = unquote(parsed_url.path).lstrip('/')
  response   = s3_client.get_object(Bucket=bucket, Key=key)
  data       = io.BytesIO(response['Body'].read())
  return Image.open(data)


def process_event(event: dict):
  """
  Processes the event and generates the embeddings
  for the given image using the CLIP model.
  :param event: The event to process.
  """
  s3_client  = boto3.client('s3')
  document   = event['data']['document']
  url        = document['url']
  etag       = document['etag']
  dest       = f"{SERVICE_NAME}/{etag}"
  metadata   = event['data']['metadata']
  
  # Load the image in memory.
  image = load_image(url)
  
  # Generate embeddings for the image.
  image_embeddings = create_image_embeddings(image)
  array = image_embeddings.cpu().numpy().tolist()[0]
  
  # Retrieve the top 5 labels for the image.
  top_labels = get_top_labels(image_embeddings, top=5) if EXTRACT_LABELS else []
  
  # Upload the data payload to S3.
  s3_client.put_object(
    Body=json.dumps(array),
    Bucket=CACHE_BUCKET,
    Key=dest
  )
      
  # Update the metadata.
  merge(metadata, {
    'keywords': top_labels,
    'properties': {
      'kind': 'text',
      'attrs': {
        'embeddings': {
          'vectors': f"s3://{CACHE_BUCKET}/{dest}",
          'model': CLIP_MODEL,
          'dimensions': len(array)
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

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
import copy

from typing import Optional
from publish import publish_event
from urllib.parse import urlparse, unquote
from botocore.config import Config
from feed_parser import parse_feed
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.data_classes import event_source, SQSEvent
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord

from aws_lambda_powertools.utilities.batch import (
  BatchProcessor,
  EventType,
  process_partial_response
)

# Environment variables.
SERVICE_NAME  = os.getenv('POWERTOOLS_SERVICE_NAME')
TARGET_BUCKET = os.getenv('PROCESSED_FILES_BUCKET')

# Runtime function attributes.
s3_client = boto3.client('s3')
logger    = Logger(service=SERVICE_NAME)
tracer    = Tracer(service=SERVICE_NAME)
processor = BatchProcessor(event_type=EventType.SQS)

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


def get_signed_url(bucket, key, expires_in=300) -> str:
  """
  Generate a signed URL for reading a file from S3 via HTTPS
  :param expires_in:  URL Expiration time in seconds
  :param bucket:      S3 Bucket name
  :param key:         S3 Key name
  :return:            Signed URL
  """
  client = boto3.client('s3', config=Config(
    signature_version='s3v4',
    s3={'addressing_style': 'virtual'})
  )
  return client.generate_presigned_url('get_object',
    Params={'Bucket': bucket, 'Key': key},
    ExpiresIn=expires_in
  )


def get_url(document):
  """
  :param document: The document to extract the URL from.
  :return:         The URL of the document.
  """
  url = urlparse(document['url'])
  
  # If the URL is a S3 URL, generate a signed URL.
  if url.scheme == 's3':
    return get_signed_url(
      bucket=unquote(url.netloc),
      key=unquote(url.path[1:])
    )
  
  return document['url']


def create_new_event(source_event: dict, feed: dict) -> dict:
  """
  Creates a new event for the feed item.
  :param source_event: The event to process.
  :param feed:         The feed item to create an event for.
  :return:             The new event.
  """
  # Create a deep copy of the original event.
  event    = copy.deepcopy(source_event)
  data     = event['data']
  metadata = data['metadata']

  # Set the current document to the feed item.
  data['document'] = {
    'url': feed['link'],
    'type': feed['type'],
    'etag': feed['hash']
  }

  # Merge the metadata of the feed item with the original metadata.
  merge(metadata, feed['metadata'])

  return event


def process_document(event: dict) -> dict:
  """
  Processes the feed document associated with the event,
  and publishes each feed item to the next middlewares.
  :param event: The event to process.
  """
  data     = event['data']
  document = data['document']
    
  # Retrieve the URL of the document.
  url = get_url(document)
  
  # Parse the HTML document as an article.
  feeds = parse_feed(url)
  
  # Publish each feed item to the next middlewares.
  for feed in feeds:
    publish_event(
      create_new_event(event, feed)
    )
  
  return event


def record_handler(record: SQSRecord, _: Optional[LambdaContext] = None):
  """
  Process the record associated with the SQS event.
  :param record: The SQS record to process.
  :param lambda_context: The Lambda context.
  """
  return process_document(json.loads(record.body))


@logger.inject_lambda_context()
@tracer.capture_lambda_handler
@event_source(data_class=SQSEvent)
def lambda_handler(event: SQSEvent, context: LambdaContext):
  """
  Processes each SQS records with partial failure handling.
  :param event:   The SQS event to process.
  :param context: The Lambda context.
  """
  return process_partial_response(
    event=event,
    record_handler=record_handler,
    processor=processor,
    context=context
  )

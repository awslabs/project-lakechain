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
import sys
import json
import boto3
import cv2
import numpy as np

from typing import Optional
from urllib.parse import urlparse, unquote
from pixelate import pixelate_faces, pixelate_objects, pixelate_text_areas
from highlight import highlight_faces, highlight_objects, highlight_text_areas, highlight_landmarks
from output import array_to_image
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.data_classes import event_source, SQSEvent
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from publish import publish_event

from aws_lambda_powertools.utilities.batch import (
  BatchProcessor,
  EventType,
  process_partial_response
)

# Environment variables.
SERVICE_NAME = os.getenv('POWERTOOLS_SERVICE_NAME')
PROCESSED_FILES_BUCKET = os.getenv('PROCESSED_FILES_BUCKET')
FILTERS = json.loads(os.getenv('FILTERS'))

# Runtime function attributes.
logger     = Logger(service=SERVICE_NAME)
tracer     = Tracer(service=SERVICE_NAME)
s3_client  = boto3.client('s3')
sns_client = boto3.client('sns')
processor  = BatchProcessor(event_type=EventType.SQS)

def load_image(url) -> bytes:
  """
  Loads the image from the given `url` in memory.
  :param url: The URL of the image to load.
  """
  bucket   = unquote(url.netloc)
  key      = unquote(url.path).lstrip('/')
  response = s3_client.get_object(Bucket=bucket, Key=key)
  return response['Body'].read()


def process_document(event: dict) -> dict:
  """
  Converts the document associated with the given cloud event
  to plain text and publishes the result to the next middlewares.
  :param event: the received cloud event.
  """

  document = event['data']['document']
  url      = urlparse(document['url'])
  filename = unquote(url.path).lstrip('/')
  etag     = document['etag']
  dest     = f"{etag}/{filename}"

  # Decode the image in memory.
  buffer = load_image(url)
  array  = cv2.imdecode(np.asarray(bytearray(buffer)), cv2.IMREAD_COLOR)
  
  # Apply the filters.
  for filter in FILTERS:
    args = filter.get('args', {})
    if filter['op'] == 'pixelate':
      if args.get('faces', False):
        array = pixelate_faces(array, event)
      if args.get('objects', False):
        array = pixelate_objects(array, event)
      if args.get('text', False):
        array = pixelate_text_areas(array, event)
    elif filter['op'] == 'highlight':
      if args.get('faces', False):
        array = highlight_faces(array, event)
      if args.get('objects', False):
        array = highlight_objects(array, event)
      if args.get('text', False):
        array = highlight_text_areas(array, event)
      if args.get('landmarks', False):
        highlight_landmarks(array, event)

  # Convert the Numpy array to an image.
  data, mime_type = array_to_image(array[:,:,::-1], document['type'])
  
  # Write the transformed image to the S3 bucket.
  upload_result = s3_client.put_object(
    Bucket=PROCESSED_FILES_BUCKET,
    Key=dest,
    Body=data,
    ContentType=mime_type
  )
  
  # Set the new document in the event.
  event |= {
    'data': event['data'] | {
      'document': {
        'url': f"s3://{PROCESSED_FILES_BUCKET}/{dest}",
        'type': mime_type,
        'size': sys.getsizeof(data),
        'etag': upload_result['ETag'].replace('"', '')
      }
    }
  }

  return event


def record_handler(record: SQSRecord, _: Optional[LambdaContext] = None):
  """
  Process the record associated with the SQS event,
  and publishes the new document to the next middlewares.
  :param record: The SQS record to process.
  :param lambda_context: The Lambda context.
  """
  return publish_event(
    process_document(json.loads(record.body))
  )


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

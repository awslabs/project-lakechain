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
import imagehash

from typing import Optional
from PIL import Image
from urllib.parse import urlparse, unquote
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
SERVICE_NAME           = os.getenv('POWERTOOLS_SERVICE_NAME')
PROCESSED_FILES_BUCKET = os.getenv('PROCESSED_FILES_BUCKET')
AVERAGE_HASHING        = os.getenv('AVERAGE_HASHING', 'true') == 'true'
PERCEPTUAL_HASHING     = os.getenv('PERCEPTUAL_HASHING', 'true') == 'true'
DIFFERENCE_HASHING     = os.getenv('DIFFERENCE_HASHING', 'true') == 'true'
WAVELET_HASHING        = os.getenv('WAVELET_HASHING', 'true') == 'true'
COLOR_HASHING          = os.getenv('COLOR_HASHING', 'true') == 'true'

# Runtime function attributes.
logger     = Logger(service=SERVICE_NAME)
tracer     = Tracer(service=SERVICE_NAME)
s3_client  = boto3.client('s3')
sns_client = boto3.client('sns')
processor  = BatchProcessor(event_type=EventType.SQS)

try:
	ANTIALIAS = Image.Resampling.LANCZOS
except AttributeError:
	# deprecated in pillow 10
	# https://pillow.readthedocs.io/en/stable/deprecations.html
	ANTIALIAS = Image.ANTIALIAS


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
      if k not in dct:
        dct[k] = merge_dct[k]


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
  Computes the image hashes for the given document.
  :param event: the received cloud event.
  """

  document = event['data']['document']
  url = urlparse(document['url'])

  # Decode the image in memory.
  buffer = load_image(url)
  image  = Image.open(io.BytesIO(buffer))
  
  # Only resize if the image dimensions are greater than 1024x1024
  max_size = (1024, 1024)
  if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
    image.thumbnail(max_size, ANTIALIAS)

  # Update the document metadata.
  merge(event['data']['metadata'], {
    'properties': {
      'kind': 'image',
      'attrs': {
        'hashes': {}
      }
    }
  })

  # Set the hashes object.
  hashes = event['data']['metadata']['properties']['attrs']['hashes']

  # Compute the average hashing of the image.
  if AVERAGE_HASHING:
    hashes['average'] = str(imagehash.average_hash(image))

  # Compute the perceptual hashing of the image.
  if PERCEPTUAL_HASHING:
    hashes['perceptual'] = str(imagehash.phash(image))

  # Compute the difference hashing of the image.
  if DIFFERENCE_HASHING:
    hashes['difference'] = str(imagehash.dhash(image))

  # Compute the wavelet hashing of the image.
  if WAVELET_HASHING:
    hashes['wavelet'] = str(imagehash.whash(image))

  # Compute the color hashing of the image.
  if COLOR_HASHING:
    hashes['color'] = str(imagehash.colorhash(image))

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

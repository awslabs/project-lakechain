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
import cv2
import numpy as np

from typing import Optional
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
DEPTH                  = int(os.getenv('DEPTH', 6))
KERNEL_SIZE            = int(os.getenv('KERNEL_SIZE', 3))

# Runtime function attributes.
logger     = Logger(service=SERVICE_NAME)
tracer     = Tracer(service=SERVICE_NAME)
s3_client  = boto3.client('s3')
sns_client = boto3.client('sns')
processor  = BatchProcessor(event_type=EventType.SQS)

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


def laplacian_variance(image, depth=cv2.CV_64F, ksize=3):
  """
  Compute the Laplacian variance of the image.
  :param image: The input image.
  :param depth: The desired depth of the Laplacian.
  :param ksize: The kernel size of the Laplacian.
  """
  if image.ndim == 3:
    gray_image = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
  else:
    gray_image = image

  # Remove the noise from the image.
  denoised = cv2.GaussianBlur(gray_image, (3, 3), 0)

  return cv2.Laplacian(denoised, depth, ksize=ksize).var()


def process_document(event: dict) -> dict:
  """
  Converts the document associated with the given cloud event
  to plain text and publishes the result to the next middlewares.
  :param event: the received cloud event.
  """

  document = event['data']['document']
  url = urlparse(document['url'])

  # Decode the image in memory.
  buffer = load_image(url)
  array  = cv2.imdecode(np.asarray(bytearray(buffer)), cv2.IMREAD_COLOR)

  # Compute the Laplacian of the image.
  variance = laplacian_variance(array, DEPTH, KERNEL_SIZE)

  # Update the document metadata.
  merge(event['data']['metadata'], {
    'properties': {
      'kind': 'image',
      'attrs': {
        'variance': variance
      }
    }
  })

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

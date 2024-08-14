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
import sys
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
SERVICE_NAME    = os.getenv('POWERTOOLS_SERVICE_NAME')
TARGET_BUCKET   = os.getenv('PROCESSED_FILES_BUCKET')
LOWER_THRESHOLD = int(os.getenv('LOWER_THRESHOLD', 100))
UPPER_THRESHOLD = int(os.getenv('UPPER_THRESHOLD', 200))
APERTURE_SIZE   = int(os.getenv('APERTURE_SIZE', 3))
L2_GRADIENT     = bool(os.getenv('L2_GRADIENT', False))

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


def image_to_bytes(image):
  """
  Converts an image to a PNG byte array.
  :param image: The image to convert.
  :param mime_type: The MIME type to convert the image to.
  :return: The image as a byte array and its MIME type.
  """
  with io.BytesIO() as bytes_io:
    image.save(bytes_io, 'PNG')
    bytes_io.seek(0)
    return bytes_io.getvalue(), 'image/png'


def canny_edge_detection(
  image,
  lower_threshold = LOWER_THRESHOLD,
  upper_threshold = UPPER_THRESHOLD,
  aperture_size = APERTURE_SIZE,
  l2_gradient = L2_GRADIENT
):
  """
  Compute the Laplacian variance of the image.
  :param image: The input image.
  :param lower_threshold: The lower threshold for the Canny edge detection.
  :param upper_threshold: The upper threshold for the Canny edge detection.
  :param aperture_size: The aperture size for the Canny edge detection.
  :param l2_gradient: The L2 gradient flag for the Canny edge detection.
  """
  # Convert the image to grayscale.
  gray_image = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

  # Remove the noise from the image.
  denoised = cv2.GaussianBlur(gray_image, (3, 3), 0)

  # Apply the Canny edge detection.
  return cv2.Canny(
    denoised,
    lower_threshold,
    upper_threshold,
    apertureSize=aperture_size,
    L2gradient=l2_gradient
  )


def process_document(event: dict) -> dict:
  """
  Computes the Laplacian variance for the given document.
  :param event: the received cloud event.
  """

  document   = event['data']['document']
  chain_id   = event['data']['chainId']
  output_key = f"{chain_id}/{document['etag']}"
  url        = urlparse(document['url'])

  # Decode the image in memory.
  buffer = load_image(url)
  array  = cv2.imdecode(np.asarray(bytearray(buffer)), cv2.IMREAD_COLOR)

  # Compute the Canny edge detection.
  edges = canny_edge_detection(array)

  # Convert the image to a byte array.
  _, buffer = cv2.imencode('.png', edges)
  png_byte_array = buffer.tobytes()

  # Write the new image to the S3 bucket.
  upload_result = s3_client.put_object(
    Bucket=TARGET_BUCKET,
    Key=output_key,
    Body=png_byte_array,
    ContentType='image/png'
  )

  # Set the new document in the event.
  event['data']['document'] = {
    'url': f"s3://{TARGET_BUCKET}/{output_key}",
    'type': 'image/png',
    'size': sys.getsizeof(png_byte_array),
    'etag': upload_result['ETag'].replace('"', '')
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

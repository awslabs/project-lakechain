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

from PIL import Image
from typing import Optional
from urllib.parse import urlparse, unquote
from rembg import remove
from publish import publish_event
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
ALPHA_MATTING = os.getenv('ALPHA_MATTING', 'false').lower() == 'true'
ALPHA_MATTING_FG_THRESHOLD = float(os.getenv('ALPHA_MATTING_FG_THRESHOLD', 240))
ALPHA_MATTING_BG_THRESHOLD = float(os.getenv('ALPHA_MATTING_BG_THRESHOLD', 10))
ALPHA_MATTING_EROSION_SIZE = int(os.getenv('ALPHA_MATTING_EROSION_SIZE', 10))
MASK_POST_PROCESSING = os.getenv('MASK_POST_PROCESSING', 'false').lower() == 'true'

# Runtime function attributes.
logger    = Logger(service=SERVICE_NAME)
tracer    = Tracer(service=SERVICE_NAME)
s3_client = boto3.client('s3')
processor = BatchProcessor(event_type=EventType.SQS)

# A dictionary of MIME types to PIL formats.
mime_type_to_pil_format = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/gif': 'GIF'
}

def load_image(url: str) -> Image:
  """
  Loads the image from the S3 bucket in memory.
  :param url: The URL of the document in the S3 bucket.
  """
  parsed_url = urlparse(url)
  bucket     = unquote(parsed_url.netloc)
  key        = unquote(parsed_url.path).lstrip('/')
  response   = s3_client.get_object(Bucket=bucket, Key=key)
  content    = response['Body'].read()
  return Image.open(io.BytesIO(content)).convert('RGB')


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


def process_document(event: dict) -> dict:
  """
  Processes the given event and its associated document, creates
  a new version of the image with the background removed, and uploads it to an S3 bucket.
  The event containing the details about the new document will be forwarded
  to the next middleware.
  :param event: the event to process.
  """
  document   = event['data']['document']
  chain_id   = event['data']['chainId']
  output_key = f"{chain_id}/{document['etag']}"
  
  # Load the content of the document in memory.
  image = load_image(document['url'])
  
  # Remove the background from the image.
  new_image = remove(
    image,
    alpha_matting=ALPHA_MATTING,
    alpha_matting_foreground_threshold=ALPHA_MATTING_FG_THRESHOLD,
    alpha_matting_background_threshold=ALPHA_MATTING_BG_THRESHOLD,
    alpha_matting_erode_size=ALPHA_MATTING_EROSION_SIZE,
    post_process_mask=MASK_POST_PROCESSING
  )

  # Convert the image to a byte array.
  data, mime_type = image_to_bytes(new_image)

  # Write the transformed image to the S3 bucket.
  upload_result = s3_client.put_object(
    Bucket=TARGET_BUCKET,
    Key=output_key,
    Body=data,
    ContentType=mime_type
  )

  # Set the new document in the event.
  event['data']['document'] = {
    'url': f"s3://{TARGET_BUCKET}/{output_key}",
    'type': mime_type,
    'size': sys.getsizeof(data),
    'etag': upload_result['ETag'].replace('"', '')
  }

  return event


def record_handler(record: SQSRecord, _: Optional[LambdaContext] = None):
  """
  Process the record associated with the SQS event.
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

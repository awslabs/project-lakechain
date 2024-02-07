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

from typing import Optional
from publish import publish_event
from urllib.parse import urlparse, unquote
from metadata import get_metadata
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.data_classes import SQSEvent
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord

from aws_lambda_powertools.utilities.batch import (
  BatchProcessor,
  EventType,
  process_partial_response
)

# Environment variables.
SERVICE_NAME = os.getenv('POWERTOOLS_SERVICE_NAME')

# Runtime function attributes.
logger    = Logger(service=SERVICE_NAME)
tracer    = Tracer(service=SERVICE_NAME)
processor = BatchProcessor(event_type=EventType.SQS)
s3_client = boto3.client('s3')

def get_signed_url(bucket: str, key: str, expires_in = 300) -> str:
  """
  Generate a signed URL for reading a file from S3 via HTTPS
  :param expires_in:  URL Expiration time in seconds
  :param bucket:      S3 Bucket name
  :param key:         S3 Key name
  :return:            Signed URL
  """
  return s3_client.generate_presigned_url('get_object',
    Params={'Bucket': bucket, 'Key': key},
    ExpiresIn=expires_in
  )


def process_document(event: dict) -> dict:
  """
  Processes a video file and extracts its metadata,
  which are then used to enrich the document metadata.
  :param event: The event to process.
  :return:      The processed event.
  """
  data = event['data']
  url  = urlparse(data['document']['url'])
  
  # Load the content of the video in memory.
  video_url = get_signed_url(
    bucket=unquote(url.netloc),
    key=unquote(url.path[1:])
  )
  
  # Enrich the event with the extracted metadata.
  data['metadata'] |= get_metadata(video_url)
    
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
def lambda_handler(event: SQSEvent, context: LambdaContext):
  """
  Processes each SQS records with partial failure handling.
  """
  return process_partial_response(
    event=event,
    record_handler=record_handler,
    processor=processor,
    context=context
  )

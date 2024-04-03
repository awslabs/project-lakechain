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

from typing import Optional
from urllib.parse import urlparse, unquote
from summarization import summarize_text
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
SERVICE_NAME        = os.getenv('POWERTOOLS_SERVICE_NAME')
TARGET_BUCKET       = os.getenv('PROCESSED_FILES_BUCKET')
SUMMARIZATION_RATIO = float(os.getenv('SUMMARIZATION_RATIO', '0.2'))

# Runtime function attributes.
logger    = Logger(service=SERVICE_NAME)
tracer    = Tracer(service=SERVICE_NAME)
s3_client = boto3.client('s3')
processor = BatchProcessor(event_type=EventType.SQS)

def load_document(url: str) -> str:
  """
  Loads the document from the S3 bucket in memory
  as UTF-8 encoded string.
  :param url: The URL of the document to load.
  :return: The content of the document as UTF-8 encoded string.
  """
  parsed_url = urlparse(url)
  response   = s3_client.get_object(
    Bucket=unquote(parsed_url.netloc),
    Key=unquote(parsed_url.path).lstrip('/')
  )
  return response['Body'].read().decode('utf-8')


def process_document(event: dict) -> dict:
  """
  Processes the given event and its associated document, creates
  a summarized version of the document and uploads it to an S3 bucket.
  The event containing the details about the new document will be forwarded
  to the next middleware.
  :param event: the event to process.
  """
  document   = event['data']['document']
  chain_id   = event['data']['chainId']
  output_key = f"{chain_id}/{document['etag']}.txt"
  
  # Load the content of the document in memory.
  text = load_document(document['url'])
  
  # Summarize the text.
  summary = summarize_text(
    content=text,
    ratio=SUMMARIZATION_RATIO
  )

  # Write the converted file to the S3 bucket.
  upload_result = s3_client.put_object(
    Bucket=TARGET_BUCKET,
    Key=output_key,
    Body=summary,
    ContentType='text/plain'
  )

  # Set the new document in the event.
  event['data']['document'] = {
    'url': f"s3://{TARGET_BUCKET}/{output_key}",
    'type': 'text/plain',
    'size': sys.getsizeof(summary),
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
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
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.data_classes import event_source, SQSEvent
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from parsing import parse_document
from publish import publish_event

from aws_lambda_powertools.utilities.batch import (
  BatchProcessor,
  EventType,
  process_partial_response
)

# Environment variables.
SERVICE_NAME  = os.getenv('POWERTOOLS_SERVICE_NAME')
TARGET_BUCKET = os.getenv('PROCESSED_FILES_BUCKET')

# Runtime function attributes.
s3_client        = boto3.client('s3')
logger           = Logger(service=SERVICE_NAME)
tracer           = Tracer(service=SERVICE_NAME)
processor        = BatchProcessor(event_type=EventType.SQS)
output_mime_type = 'text/plain'

def merge(dct, merge_dct):
  """ Recursive dict merge. Inspired by :meth:``dict.update()``, instead of
  updating only top-level keys, dict_merge recurses down into dicts nested
  to an arbitrary depth, updating keys. The ``merge_dct`` is merged into
  ``dct``.
  :param dct: dict onto which the merge is executed
  :param merge_dct: dct merged into dct
  :return: None
  """
  for k, v in merge_dct.items():
    if (k in dct and isinstance(dct[k], dict) and isinstance(merge_dct[k], dict)):
      merge(dct[k], merge_dct[k])
    else:
      dct[k] = merge_dct[k]


def process_document(event: dict) -> dict:
  """
  Converts the document associated with the given cloud event
  to plain text and publishes the result to the next middlewares.
  :param event: the received cloud event.
  """
  document = event['data']['document']
  etag     = document['etag']
  dest     = f"{etag}.txt"
  
  # Parse the document.
  metadata, data = parse_document(document['url'])
    
  # Write the converted file to the S3 bucket.
  upload_result = s3_client.put_object(
    Bucket=TARGET_BUCKET,
    Key=dest,
    Body=data,
    ContentType=output_mime_type
  )

  # Merge the metadata.
  merge(event['data']['metadata'], metadata)
  
  # Update the document.
  event |= {
    'data': event['data'] | {
      'document': {
        'url': f"s3://{TARGET_BUCKET}/{dest}",
        'type': output_mime_type,
        'size': sys.getsizeof(data),
        'etag': upload_result['ETag'].replace('"', '')
      }
    }
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

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
from publish import publish_event
from urllib.parse import urlparse, unquote
from metadata import get_metadata
from botocore.config import Config
from trafilatura import fetch_url, extract
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
      if k not in dct:
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


def parse_document(url: str) -> dict:
  """
  Parses the given HTML document.
  :param url: The URL of the document to parse.
  :return:    The parsed document.
  """
  return json.loads(extract(
    fetch_url(url),
    output_format="json",
    include_table=True,
    include_comments=False,
    include_images=False
  ))


def process_document(event: dict) -> dict:
  """
  Processes the HTML document associated with the given event.
  This document will then be passed to the newspaper3k parser,
  and metadata will be extracted from it.
  A text file will be created from the parsed document and
  uploaded to the S3 bucket.
  :param event: The event to process.
  :return:      The processed event.
  """
  data       = event['data']
  document   = data['document']
  chain_id   = data['chainId']
  output_key = f"{chain_id}/{document['etag']}.txt";
  
  # Retrieve the URL of the document.
  url = get_url(document)
  
  # Parse the HTML document.
  result = parse_document(url)
  
  # Write the converted file to the S3 bucket.
  upload_result = s3_client.put_object(
    Bucket=TARGET_BUCKET,
    Key=output_key,
    Body=result['text'],
    ContentType='text/plain'
  )
  
  # Set the new document in the event.
  event['data']['document'] = {
    'url': f"s3://{TARGET_BUCKET}/{output_key}",
    'type': 'text/plain',
    'size': sys.getsizeof(result['text']),
    'etag': upload_result['ETag'].replace('"', '')
  }
  
  # Enrich the event with the extracted metadata.
  merge(data['metadata'], get_metadata(result))
  
  return event


def record_handler(record: SQSRecord, _: Optional[LambdaContext] = None):
  """
  Process the record associated with the SQS event.
  :param record: The SQS record to process.
  :param _: The Lambda context.
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

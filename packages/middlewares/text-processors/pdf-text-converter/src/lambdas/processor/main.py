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
import copy
import uuid

from typing import Optional
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.data_classes import event_source, SQSEvent
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from urllib.parse import urlparse, unquote
from publish import publish_event

from metadata import (
  get_document_metadata,
  get_layout_from_document,
  get_layout_from_page
)
from parsing import (
  pdf_document_to_text,
  pdf_document_to_image,
  pdf_page_to_text,
  pdf_page_to_image,
  pdf_document_to_page
)
from aws_lambda_powertools.utilities.batch import (
  BatchProcessor,
  EventType,
  process_partial_response
)

# Environment variables.
SERVICE_NAME   = os.getenv('POWERTOOLS_SERVICE_NAME')
TARGET_BUCKET  = os.getenv('PROCESSED_FILES_BUCKET')
TASK           = json.loads(os.getenv('TASK', '{}'))

# Runtime function attributes.
s3_client      = boto3.client('s3')
logger         = Logger(service=SERVICE_NAME)
tracer         = Tracer(service=SERVICE_NAME)
processor      = BatchProcessor(event_type=EventType.SQS)

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


def load_document(url: str) -> bytes:
  """
  Loads the document from the S3 bucket in memory as UTF-8 encoded string.
  :param url: The URL of the document to load.
  :return: The content of the document as bytes.
  """
  s3_client  = boto3.client('s3')
  parsed_url = urlparse(url)
  response   = s3_client.get_object(
    Bucket=unquote(parsed_url.netloc),
    Key=unquote(parsed_url.path).lstrip('/')
  )
  return response['Body'].read()


def send_document(event: dict, data: bytes, mime_type: str, name: str):
  """
  Sends the document to the S3 bucket.
  :param data: The content of the document to send.
  :param mime_type: The MIME type of the document.
  :param name: The name of the document to send.
  """
  upload_result = s3_client.put_object(
    Bucket=TARGET_BUCKET,
    Key=name,
    Body=data,
    ContentType=mime_type
  )

  # Update the document.
  event['data']['document'] = {
    'url': f"s3://{TARGET_BUCKET}/{name}",
    'type': mime_type,
    'size': sys.getsizeof(data),
    'etag': upload_result['ETag'].replace('"', '')
  }

  # Publish the event to the next middleware.
  return publish_event(event)


def extract_pages(event: dict, output_type = 'text') -> bytes:
  """
  Extracts data from the pages of the document.
  :param data: The content of the PDF document to extract.
  :param output_type: The type of the output to generate.
  :return: The extracted text from the document.
  """
  document = event['data']['document']
  doc_meta = event['data']['metadata']
  data     = load_document(document['url'])
  metadata = get_document_metadata(data)
  attrs    = doc_meta.get('properties', {}).get('attrs', {})
  pages    = metadata['properties']['attrs']['pages']

  for page_idx in range(pages):    
    clone       = copy.deepcopy(event)
    page_number = page_idx + 1
    name        = f"{document['etag']}/{str(uuid.uuid4())}-page-{page_number}"

    # Enrich the event with the document and page metadata.
    if not 'pages' in attrs:
      merge(clone['data']['metadata'], metadata)
    
    # Set the current document page number.
    if not 'page' in attrs:
      clone['data']['metadata']['properties']['attrs']['page'] = page_number
    
    # Extract the layout of the page.
    if TASK['layoutExtraction'] and not 'layout' in attrs:
      merge(event['data']['metadata'], get_layout_from_page(data, page_number))
    
    # Document conversion.
    if output_type == 'text':
      send_document(clone, pdf_page_to_text(data, page_number), 'text/plain', name)
    elif output_type == 'image':
      send_document(clone, pdf_page_to_image(data, page_number), 'image/jpeg', name)
    elif output_type == 'pdf':
      send_document(clone, pdf_document_to_page(data, page_number), 'application/pdf', name)


def extract_document(event: dict, output_type = 'text') -> bytes:
  """
  Extracts data from the document.
  :param data: The content of the PDF document to extract.
  :param output_type: The type of the output to generate.
  :return: The extracted text from the document.
  """
  document = event['data']['document']
  doc_meta = event['data']['metadata']
  chain_id = event['data']['chainId']
  data     = load_document(document['url'])
  metadata = get_document_metadata(data)
  attrs    = doc_meta.get('properties', {}).get('attrs', {})
  name     = f"{document['etag']}/{chain_id}-{str(uuid.uuid4())}-output"

  # Enrich the event with the document metadata.
  if not 'pages' in attrs:
    merge(event['data']['metadata'], metadata)

  # Extract the layout of the document.
  if TASK['layoutExtraction']:
    merge(event['data']['metadata'], get_layout_from_document(data))

  # Document conversion.
  if output_type == 'text':
    send_document(event, pdf_document_to_text(data), 'text/plain', name)
  elif output_type == 'image':
    send_document(event, pdf_document_to_image(data), 'image/jpeg', name)


def process_document(event: dict) -> dict:
  """
  Converts the document associated with the given cloud event
  to plain text and publishes the result to the next middlewares.
  :param event: the received cloud event.
  """
  segmentation = TASK['segmentationType']
  output_type  = TASK['outputType']

  if segmentation == 'page':
    return extract_pages(event, output_type)
  elif segmentation == 'document':
    return extract_document(event, output_type)
  else:
    raise ValueError(f"Invalid segmentation type: {segmentation}")


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

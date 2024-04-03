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
import nltk
import hashlib

from nltk.tokenize import TextTilingTokenizer
from typing import Optional
from publish import publish_event
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.data_classes import SQSEvent, event_source
from aws_lambda_powertools.utilities.typing import LambdaContext
from urllib.parse import urlparse, unquote
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord

from aws_lambda_powertools.utilities.batch import (
  BatchProcessor,
  EventType,
  process_partial_response
)

# Environment variables.
SERVICE_NAME         = os.getenv('POWERTOOLS_SERVICE_NAME')
TARGET_BUCKET        = os.getenv('PROCESSED_FILES_BUCKET')
CACHE_DIR            = os.environ.get('CACHE_DIR')
PSEUDO_SENTENCE_SIZE = int(os.environ.get('PSEUDO_SENTENCE_SIZE', 50))

# Runtime function attributes.
logger    = Logger(service=SERVICE_NAME)
tracer    = Tracer(service=SERVICE_NAME)
s3_client = boto3.client('s3')
processor = BatchProcessor(event_type=EventType.SQS)

# Download the nltk punkt tokenizer and set
# the download directory.
nltk.data.path.append(CACHE_DIR)
nltk.download('punkt', download_dir=CACHE_DIR)
nltk.download('stopwords', download_dir=CACHE_DIR)

def load_document(url) -> str:
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


def get_metadata(chunk: str, order: int) -> dict:
  """
  :param chunk: The chunk to process.
  :param order: The order of the chunk.
  :return: The metadata for the given chunk.
  """
  return {
    'properties': {
      'kind': 'text',
      'attrs': {
        'chunk': {
          'id': hashlib.sha256(chunk.encode('utf-8')).hexdigest(),
          'order': order
        }
      }
    }
  }


def on_chunk(chunk: str, order: int, event: dict):
  """
  Publishes the chunk to the next middlewares.
  """
  document   = event['data']['document']
  chain_id   = event['data']['chainId']
  output_key = f"{chain_id}/tiling-text-splitter-{document['etag']}-{order}.txt"
  
  # Write the converted file to the S3 bucket.
  result = s3_client.put_object(
    Bucket=TARGET_BUCKET,
    Key=output_key,
    Body=chunk,
    ContentType='text/plain'
  )
  
  # Set the new document in the event.
  event['data']['document'] = {
    'url': f"s3://{TARGET_BUCKET}/{output_key}",
    'type': 'text/plain',
    'size': sys.getsizeof(chunk),
    'etag': result['ETag'].replace('"', '')
  }
  
  # Update the metadata.
  event['data']['metadata'] |= get_metadata(chunk, order)
  
  return publish_event(event)


def document_handler(event: dict):
  """
  Splits the text of the document associated with
  the given cloud event and publishes the result
  to the next middlewares.
  """
  document = event['data']['document']
  
  # Load the content of the document in memory.
  text = load_document(document['url'])
  
  # Split the text.
  chunks = TextTilingTokenizer(w=PSEUDO_SENTENCE_SIZE).tokenize(text)
  for idx, tile in enumerate(chunks):
    on_chunk(tile, idx, event)
  
  return event


def record_handler(
  record: SQSRecord,
  _: Optional[LambdaContext] = None
):
  """
  Process the record associated with the SQS event.
  """
  return document_handler(json.loads(record.body))


@logger.inject_lambda_context()
@tracer.capture_lambda_handler
@event_source(data_class=SQSEvent)
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

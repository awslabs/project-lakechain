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
import traceback
import logging

from summarization import summarize_text
from publish import publish_event
from urllib.parse import urlparse, unquote
from message_provider import sqs_consume_queue

# Configure the logger for the application.
logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s - %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

# Environment variables.
INPUT_QUEUE_URL       = os.getenv('INPUT_QUEUE_URL')
TARGET_BUCKET         = os.getenv('PROCESSED_FILES_BUCKET')
CACHE_DIR             = os.getenv('CACHE_DIR')
CHUNK_SIZE            = int(os.getenv('CHUNK_SIZE', '4000'))
SUMMARIZED_CHUNK_SIZE = int(os.getenv('SUMMARIZED_CHUNK_SIZE', '1024'))
OUTPUT_TYPE           = 'text/plain'

def load_document(url) -> str:
  """
  Loads the document from the S3 bucket in memory
  as UTF-8 encoded string.
  :param url: The URL of the document to load.
  :return: The content of the document as UTF-8 encoded string.
  """
  s3_client  = boto3.client('s3')
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
  :param event: the received cloud event.
  :return: the processed event.
  """
  s3_client  = boto3.client('s3')
  document   = event['data']['document']
  chain_id   = event['data']['chainId']
  output_key = f"{chain_id}/{document['etag']}.txt";
  
  # Load the content of the document in memory.
  text = load_document(document['url'])
  
  # Summarize the text.
  summary = summarize_text(
    content=text,
    chunk_size=CHUNK_SIZE,
    summarized_chunk_size=SUMMARIZED_CHUNK_SIZE
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


def on_message(message: dict):
  """
  Worker function processing a message and
  publishing the result on the output SNS topic
  to the next middlewares.
  
  When successfully processed, the message is also
  deleted from the originating SQS queue.
  :param message: The message to process.
  """
  try:
    logging.info(f'Processing message {message["MessageId"]}')
    sqs_client = boto3.client('sqs')
    event      = json.loads(message['Body'])
    
    # Create the summarized version of the document
    # and publish the event to the next middleware.
    publish_event(process_document(event))
    
    # Deleting the message from the queue.
    sqs_client.delete_message(
      QueueUrl=INPUT_QUEUE_URL,
      ReceiptHandle=message['ReceiptHandle']
    )
  except Exception:
    traceback.print_exc()


#
# Main entry point.
#
if __name__ == "__main__":
  sqs_consume_queue(
    queue_url=INPUT_QUEUE_URL,
    message_processor=on_message
  )

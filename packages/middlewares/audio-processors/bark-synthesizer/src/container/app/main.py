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
import sys
import boto3
import traceback
import logging

# Configure the logger for the application.
logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s - %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

from publish import publish_event
from urllib.parse import urlparse, unquote
from message_provider import sqs_consume_queue
from synthesize import synthesize_text
from voice_selector import get_voice

# Environment variables.
INPUT_QUEUE_URL = os.getenv('INPUT_QUEUE_URL')
TARGET_BUCKET   = os.getenv('PROCESSED_FILES_BUCKET')
TEMPERATURE     = float(os.getenv('TEMPERATURE', "0.5"))
OUTPUT_TYPE     = 'audio/mpeg'

def load_document(url: str) -> str:
  """
  Loads the document from the given `url` in memory.
  :param url: The URL of the document to load.
  :return: The document as a string.
  """
  s3_client  = boto3.client('s3')
  parsed_url = urlparse(url)
  bucket     = unquote(parsed_url.netloc)
  key        = unquote(parsed_url.path).lstrip('/')
  response   = s3_client.get_object(Bucket=bucket, Key=key)
  return response['Body'].read().decode('utf-8')


def process_event(event: dict):
  """
  Converts the document associated with the given event
  to a speech as an audio file and uploads it to S3.
  :param event: The event to process.
  """
  s3_client = boto3.client('s3')
  document  = event['data']['document']
  url       = document['url']
  dest      = f"{event['data']['chainId']}/{document['etag']}"
  
  # Load the document in memory.
  data = load_document(url)
  
  # Attempt to infer the voice to use.
  voice = get_voice(event)
  if not voice:
    raise Exception(f'Could not infer a voice for the document {url}')
  
  # Synthesize the text.
  audio = synthesize_text(
    data,
    temperature=TEMPERATURE,
    voice=voice
  )
  
  # Upload the data payload to S3.
  result = s3_client.put_object(
    Body=audio,
    Bucket=TARGET_BUCKET,
    Key=dest,
    ContentType=OUTPUT_TYPE
  )
  
  # Set the new document in the event.
  event['data']['document'] = {
    'url': f"s3://{TARGET_BUCKET}/{dest}",
    'type': OUTPUT_TYPE,
    'size': sys.getsizeof(audio),
    'etag': result['ETag'].replace('"', '')
  }
  
  return event


def on_message(message: dict):
  """
  Worker function processing a message and
  publishing the result on the output SNS topic
  to the next middlewares.
  
  When successfully processed, the message is also
  deleted from the originating SQS queue.
  """
  try:
    sqs_client = boto3.client('sqs')
    event      = json.loads(message['Body'])
    
    # Generate the embeddings for the document.
    publish_event(process_event(event))
    
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

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

from publish import publish_event
from message_provider import sqs_consume_queue
from transform import transform_document

# Configure the logger for the application.
logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s - %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

# Environment variables.
SERVICE_NAME    = os.getenv('POWERTOOLS_SERVICE_NAME')
INPUT_QUEUE_URL = os.getenv('INPUT_QUEUE_URL')
TARGET_BUCKET   = os.getenv('PROCESSED_FILES_BUCKET')

def generate_text(event: dict):
  """
  Generates text using the selected ollama model and
  the input document.
  :param event: The event to process.
  """
  s3_client = boto3.client('s3')
  document  = event['data']['document']
  etag      = document['etag']
  dest      = f"{SERVICE_NAME}/{etag}"
  
  # Transform the document.
  data = transform_document(document)
    
  # Upload the data payload to S3.
  result = s3_client.put_object(
    Body=data,
    Bucket=TARGET_BUCKET,
    Key=dest,
    ContentType='text/plain'
  )

  # Set the new document in the event.
  event['data']['document'] = {
    'url': f"s3://{TARGET_BUCKET}/{dest}",
    'type': 'text/plain',
    'size': sys.getsizeof(data),
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
  :param message: The message to process.
  """
  try:
    sqs_client = boto3.client('sqs')
    event      = json.loads(message['Body'])
    
    # Generate the text from the model.
    publish_event(generate_text(event))
    
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

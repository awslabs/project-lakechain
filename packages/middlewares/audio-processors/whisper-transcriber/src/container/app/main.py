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
import traceback
import logging
import contextlib

from urllib.parse import urlparse, quote, unquote
from transcription import TranscriptionInput
from publish import publish_event
from message_provider import sqs_consume_queue
from engines.factory import create_engine

# Logging configuration
logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s - %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

# Environment variables.
CACHE_DIR       = os.environ.get('CACHE_DIR')
INPUT_QUEUE_URL = os.environ.get('INPUT_QUEUE_URL')
OUTPUT_FORMAT   = os.environ.get('OUTPUT_FORMAT', 'vtt')
TARGET_BUCKET   = os.environ.get('PROCESSED_FILES_BUCKET')
WHISPER_ENGINE  = os.environ.get('WHISPER_ENGINE', 'openai_whisper')

# Create the Whisper engine to use for transcriptions.
engine = create_engine()
logging.info(f'Loaded model: {engine.model_name} on device: {engine.device}')

def process_event(event: TranscriptionInput):
  """
  Event processor taking as an input an S3 object
  and producing a transcription result as an output
  on the target bucket.
  :param event: The transcription event to process.
  """
  try:
    s3_client  = boto3.client('s3')
    filename   = event.s3_key.rsplit('/', 1)[0]
    
    # Download the audio file from S3 into the cache directory.
    local_file = os.path.join(CACHE_DIR, f'{event.etag}-{filename}')
    s3_client.download_file(event.s3_bucket, event.s3_key, local_file)

    # Transcribe the audio file.
    result = engine.transcribe(
      file_path=local_file,
      output=event.output,
      language=event.language
    )

    # Upload the transcription result to the target bucket.
    data_payload    = result.getvalue()
    output_filename = f'{filename}-transcript.{event.output}'
    output_key      = f'transcriptions/{output_filename}'
    upload_result   = s3_client.put_object(
      Body=data_payload,
      Bucket=TARGET_BUCKET,
      ContentType=event.output.as_mime_type(),
      Key=output_key
    )
    
    return {
      'url': f's3://{quote(TARGET_BUCKET)}/{quote(output_key)}',
      'etag': upload_result['ETag'].replace('"', ''),
      'size': len(data_payload),
      'type': event.output.as_mime_type()
    }
  
  finally:
    # Remove the file from the local cache if it exists.
    with contextlib.suppress(FileNotFoundError):
      os.remove(local_file)


def on_message(message: dict):
  """
  Processes a message and publishes the result on the
  output SNS topic to the next middlewares.
  When successfully processed, the message is also
  deleted from the originating SQS queue.
  :param message: The message to process.
  """
  try:
    logging.info(f'Processing message {message["MessageId"]}')
    sqs_client = boto3.client('sqs')
    event      = json.loads(message['Body'])
    url        = urlparse(event['data']['document']['url'])
    
    # Processing the event.
    event['data']['document'] = process_event(TranscriptionInput(
      s3_bucket=unquote(url.netloc),
      s3_key=unquote(url.path[1:]),
      etag=event['data']['document']['etag'],
      output=OUTPUT_FORMAT
    ))
    
    # Publish the event to the next middlewares.
    publish_event(event)
    
    # Delete the message from the queue.
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

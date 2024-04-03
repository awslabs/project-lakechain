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

from urllib.parse import urlparse, unquote
from publish import publish_event
from message_provider import sqs_consume_queue
from engines.factory import create_engine
from transcription import TranscriptionOutput

# Logging configuration
logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s - %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

# Environment variables.
CACHE_DIR       = os.environ.get('CACHE_DIR')
INPUT_QUEUE_URL = os.environ.get('INPUT_QUEUE_URL')
TARGET_BUCKET   = os.environ.get('PROCESSED_FILES_BUCKET')
WHISPER_ENGINE  = os.environ.get('WHISPER_ENGINE', 'openai_whisper')
OUTPUT_FORMAT   = TranscriptionOutput(os.environ.get('OUTPUT_FORMAT', 'vtt'))

# Create the Whisper engine to use for transcriptions.
engine = create_engine()
logging.info(f'Loaded model: {engine.model_name} on device: {engine.device}')

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


def process_event(event: dict):
  """
  Event processor taking as an input an S3 object
  and producing a transcription result as an output
  on the target bucket.
  :param event: The event associated with the input document to process.
  :return: The event with the transcription result.
  """
  try:
    s3_client  = boto3.client('s3')
    url        = urlparse(event['data']['document']['url'])
    chain_id   = event['data']['chainId']
    s3_bucket  = unquote(url.netloc)
    s3_key     = unquote(url.path[1:])
    filename   = s3_key.rsplit('/', 1)[0]
    mime_type  = OUTPUT_FORMAT.as_mime_type()
    
    # Download the audio file from S3 into the cache directory.
    local_file = os.path.join(CACHE_DIR, f'{chain_id}-{filename}')
    s3_client.download_file(s3_bucket, s3_key, local_file)

    # Transcribe the audio file.
    result, language = engine.transcribe(
      file_path=local_file,
      output=OUTPUT_FORMAT
    )

    # Upload the transcription result to the target bucket.
    data_payload    = result.getvalue()
    output_filename = f'{filename}-transcript.{OUTPUT_FORMAT}'
    output_key      = f'transcriptions/{output_filename}'
    upload_result   = s3_client.put_object(
      Body=data_payload,
      Bucket=TARGET_BUCKET,
      ContentType=mime_type,
      Key=output_key
    )

    # Update the event with the new document.
    event['data']['document'] = {
      'url': f's3://{TARGET_BUCKET}/{output_key}',
      'etag': upload_result['ETag'].replace('"', ''),
      'size': len(data_payload),
      'type': mime_type
    }

    # Update the metadata with the language of the transcript.
    if language:
      merge(event['data']['metadata'], {
        'properties': {
          'kind': 'text',
          'attrs': {
            'language': language
          }
        }
      })
    
    return event
  
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
    sqs_client = boto3.client('sqs')
    event      = json.loads(message['Body'])
    url        = urlparse(event['data']['document']['url'])
    
    # Process the event, and publish the transcript
    # to the next middlewares.
    publish_event(process_event(event))
    
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

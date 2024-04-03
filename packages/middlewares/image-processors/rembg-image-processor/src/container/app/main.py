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
import io
import sys
import json
import boto3
import traceback
import logging

from PIL import Image
from publish import publish_event
from urllib.parse import urlparse, unquote
from rembg import remove
from message_provider import sqs_consume_queue

# Configure the logger for the application.
logging.basicConfig(
  level=logging.INFO,
  format='%(asctime)s - %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

# Environment variables.
INPUT_QUEUE_URL = os.getenv('INPUT_QUEUE_URL')
TARGET_BUCKET   = os.getenv('PROCESSED_FILES_BUCKET')
ALPHA_MATTING   = os.getenv('ALPHA_MATTING', 'false').lower() == 'true'
ALPHA_MATTING_FG_THRESHOLD = float(os.getenv('ALPHA_MATTING_FG_THRESHOLD', 240))
ALPHA_MATTING_BG_THRESHOLD = float(os.getenv('ALPHA_MATTING_BG_THRESHOLD', 10))
ALPHA_MATTING_EROSION_SIZE = int(os.getenv('ALPHA_MATTING_EROSION_SIZE', 10))
MASK_POST_PROCESSING = os.getenv('MASK_POST_PROCESSING', 'false').lower() == 'true'

# A dictionary of MIME types to PIL formats.
mime_type_to_pil_format = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/gif': 'GIF'
}

def load_image(url: str) -> Image:
  """
  Loads the image from the S3 bucket in memory.
  :param url: The URL of the document in the S3 bucket.
  """
  s3_client  = boto3.client('s3')
  parsed_url = urlparse(url)
  bucket     = unquote(parsed_url.netloc)
  key        = unquote(parsed_url.path).lstrip('/')
  response   = s3_client.get_object(Bucket=bucket, Key=key)
  content    = response['Body'].read()
  return Image.open(io.BytesIO(content)).convert('RGB')


def image_to_bytes(image):
  """
  Converts an image to a PNG byte array.
  :param image: The image to convert.
  :param mime_type: The MIME type to convert the image to.
  :return: The image as a byte array and its MIME type.
  """
  with io.BytesIO() as bytes_io:
    image.save(bytes_io, 'PNG')
    bytes_io.seek(0)
    return bytes_io.getvalue(), 'image/png'


def process_document(event: dict) -> dict:
  """
  Processes the given event and its associated document, creates
  a summarized version of the document and uploads it to an S3 bucket.
  :param event: the event to process.
  :return: the processed event.
  """
  s3_client  = boto3.client('s3')
  document   = event['data']['document']
  chain_id   = event['data']['chainId']
  output_key = f"{chain_id}/{document['etag']}"
  
  # Load the content of the document in memory.
  image = load_image(document['url'])
  
  # Remove the background from the image.
  new_image = remove(
    image,
    alpha_matting=ALPHA_MATTING,
    alpha_matting_foreground_threshold=ALPHA_MATTING_FG_THRESHOLD,
    alpha_matting_background_threshold=ALPHA_MATTING_BG_THRESHOLD,
    alpha_matting_erode_size=ALPHA_MATTING_EROSION_SIZE,
    post_process_mask=MASK_POST_PROCESSING
  )

  # Convert the image to a byte array.
  data, mime_type = image_to_bytes(new_image)

  # Write the transformed image to the S3 bucket.
  upload_result = s3_client.put_object(
    Bucket=TARGET_BUCKET,
    Key=output_key,
    Body=data,
    ContentType=mime_type
  )

  # Set the new document in the event.
  event['data']['document'] = {
    'url': f"s3://{TARGET_BUCKET}/{output_key}",
    'type': mime_type,
    'size': sys.getsizeof(data),
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
    
    # Generate the summary and publish the result to the next middlewares.
    publish_event(process_document(event))
    
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

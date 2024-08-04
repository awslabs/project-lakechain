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
import traceback
import asyncio
import aioboto3

from urllib.parse import urlparse, unquote
from publish import publish_event
from embedding import create_embeddings, exists, pull

# Environment variables.
SERVICE_NAME       = os.getenv('POWERTOOLS_SERVICE_NAME')
INPUT_QUEUE_URL    = os.getenv('INPUT_QUEUE_URL')
CACHE_BUCKET       = os.getenv('LAKECHAIN_CACHE_STORAGE')
EMBEDDING_MODEL    = os.getenv('OLLAMA_MODEL')
OLLAMA_CONCURRENCY = int(os.getenv('OLLAMA_NUM_PARALLEL', 1))

async def load_document(url: str) -> bytes:
  """
  Loads the document from the given `url` in memory.
  :param url: The URL of the document to load.
  :return: The document bytes.
  """
  async with aioboto3.Session().client('s3') as s3_client:
    parsed_url = urlparse(url)
    bucket     = unquote(parsed_url.netloc)
    key        = unquote(parsed_url.path).lstrip('/')
    response   = await s3_client.get_object(Bucket=bucket, Key=key)
    return await response['Body'].read()


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


async def create_document(event: dict) -> dict:
  """
  Creates embeddings for the document associated
  with the given event.
  The embeddings will be referenced in the event metadata.
  :param event: The event to process.
  """
  document = event['data']['document']
  metadata = event['data']['metadata']
  etag     = document['etag']
  dest     = f"{SERVICE_NAME}/{etag}"
  
  # Load the document in memory.
  content = await load_document(document['url'])

  # Generate embeddings concurrently.
  embeddings = await asyncio.to_thread(
    create_embeddings,
    content=content,
    model=EMBEDDING_MODEL
  )

  # Upload the embeddings to the cache storage.
  async with aioboto3.Session().client('s3') as s3_client:
    await s3_client.put_object(
      Body=json.dumps(embeddings),
      Bucket=CACHE_BUCKET,
      Key=dest
    )

  # Update the metadata.
  merge(metadata, {
    'properties': {
      'kind': 'text',
      'attrs': {
        'embeddings': {
          'vectors': f"s3://{CACHE_BUCKET}/{dest}",
          'model': EMBEDDING_MODEL,
          'dimensions': len(embeddings)
        }
      }
    }
  })

  return event


async def on_message(message: dict):
  """
  Worker function processing a message and
  publishing the result on the output SNS topic
  to the next middlewares.
  
  When successfully processed, the message is also
  deleted from the originating SQS queue.
  :param message: The message to process.
  """
  try:
    async with aioboto3.Session().client('sqs') as sqs_client:
      event = json.loads(message['Body'])

      # Generate the embeddings for the document.
      document = await create_document(event)
      
      # Forward the document to the next middlewares.
      await publish_event(document)
      
      # Delete the message from the queue.
      await sqs_client.delete_message(
        QueueUrl=INPUT_QUEUE_URL,
        ReceiptHandle=message['ReceiptHandle']
      )
  except Exception:
    traceback.print_exc()


async def on_message_batch(messages: list):
  """
  Worker function processing a batch of documents
  and publishing their embeddings on the output SNS topic
  to the next middlewares.
  When successfully processed, the messages are also
  deleted from the originating SQS queue.
  :param messages: The messages to process.
  """
  await asyncio.gather(*[on_message(message) for message in messages])


async def process_messages(queue_url: str, max_message_batch: int):
  """
  Pull messages from the given SQS queue URL.
  :param queue_url: The URL of the SQS queue to pull messages from.
  :param max_message_batch: The maximum number of messages to pull.
  :return: The messages pulled from the queue.
  """
  async with aioboto3.Session().client('sqs') as sqs_client:
    while True:
      result = await sqs_client.receive_message(
        QueueUrl=queue_url,
        MaxNumberOfMessages=max_message_batch,
        WaitTimeSeconds=20
      )
      messages = result.get('Messages', [])

      if len(messages) > 0:
        await on_message_batch(messages)
      else:
        # If there are no more messages to process,
        # we interrupt the loop and break.
        # This will cause the container to stop.
        break

#
# Main entry point.
#
if __name__ == "__main__":
  # Pull the ollama model locally if it does not exist.
  if not exists(EMBEDDING_MODEL):
    pull(EMBEDDING_MODEL)

  # Start the event loop.
  asyncio.run(
    process_messages(INPUT_QUEUE_URL, OLLAMA_CONCURRENCY)
  )

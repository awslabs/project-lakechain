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
import ollama
import time
from filelock import FileLock

# Environment variables.
CACHE_DIR = os.getenv('OLLAMA_MODELS', '/tmp')

def exists(model: str):
  """
  Checks if the given ollama model exists in the cache.
  :param model: The name of the ollama model.
  :return: True if the model exists, False otherwise.
  """
  try:
    ollama.show(model)
    return True
  except:
    return False


def pull(model: str):
  """
  Pulls the given model locally.
  This function will create a distributed lock on the network
  filesystem to ensure that only one process can pull the model
  at a time.
  :param model: The name of the ollama model to pull.
  """
  lock = FileLock(os.path.join(CACHE_DIR, f'{model}.lock'))
  
  with lock.acquire(timeout=30):
    previous_ms = 0
    for progress in ollama.pull(model, stream=True):
      digest = progress.get('digest', '')

      if not digest:
        print(progress.get('status'))
        continue

      # Display progress every 5 seconds.
      current_ms = round(time.time() * 1000)
      if current_ms - previous_ms > 5000:
        total = progress.get('total', 0)
        completed = progress.get('completed', 0)
        percent = completed / total * 100
        previous_ms = current_ms
        print(f'Progress: {percent:.2f}%')


def create_embeddings(content: bytes, model: str) -> dict:
  """
  Processes the given document content using the ollama model.
  :param content: The content to embed.
  :param model: The ollama model to use.
  :return: The processed content.
  """
  return ollama.embeddings(
    model=model,
    prompt=content.decode('utf-8')
  )['embedding']

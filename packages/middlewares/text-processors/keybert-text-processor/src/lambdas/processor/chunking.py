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

import nltk
from typing import List
from nltk.tokenize import sent_tokenize

# Set the cache directory.
nltk.data.path.append('/tmp')

def chunk_text(text: str, max_byte_length: int) -> List[str]:
  """
  Attempts to chunk the given text into chunks of
  sentences of up to the given maximum byte length.
  :param text: The text to chunk.
  :param max_byte_length: The maximum byte length of each chunk.
  :return: A list of chunks associated with the given text.
  """
  chunks = []
  sentences = sent_tokenize(text)
  currentChunk = ''

  for idx, sentence in enumerate(sentences):
    chunkByteLength = len(currentChunk.encode('utf-8'))
    currentSentence = sentence
    currentSentenceByteLength = len(currentSentence.encode('utf-8'))

    if currentSentenceByteLength + chunkByteLength > max_byte_length:
      chunks.append(currentChunk)
      currentChunk = currentSentence
    else:
      currentChunk += currentSentence

    if idx == len(sentences) - 1:
      chunks.append(currentChunk)

  return chunks
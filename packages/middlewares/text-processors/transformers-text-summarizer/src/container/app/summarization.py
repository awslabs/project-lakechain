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
import torch

from transformers import pipeline
from nlpretext import Preprocessor
from chunking import chunk_text

# Environment variables.
SUMMARIZATION_MODEL = os.getenv('SUMMARIZATION_MODEL')

# Load the summarization pipeline.
summarizer = pipeline(
  'summarization',
  model=SUMMARIZATION_MODEL,
  framework='pt',
  device=torch.cuda.current_device()
)

# An array of characters used to identify the lines
# that should be filtered out from the text.
# For example, ASCII tables are not relevant for
# the summarization process.
chars_to_filter = ['+', '╒', '│', '╘', '╞', '├', '|', '[', ']', '…']


def filter_lines(text, filters) -> str:
  """
  Filters out lines from the text string that start with any of the characters in filters.
  """
  filtered_lines = [line for line in text.split('\n') if not any(line.startswith(char) for char in filters)]
  return '\n'.join(filtered_lines)


def clean_text(text: str) -> str:
  """
  :param text: The text to clean.
  :return: A cleaned version of the text in which new lines and tabs are replaced by spaces,
  tables are removed and each sentence is stripped.
  """
  return Preprocessor().run(
    filter_lines(text, chars_to_filter)
  )


def summarize_chunk(
  content: str,
  max_length: int = 1024,
  truncation: bool = True
) -> str:
  """
  Summarizes the given text content using the HuggingFace summarization pipeline.
  :param content: The text content to summarize.
  :param max_length: The maximum length of each chunk generated as part
  of the summarization process.
  :param truncation: Whether to truncate the content.
  """
  result = summarizer(
    content,
    max_length=max_length,
    truncation=truncation
  )
  return result[0]['summary_text']


def summarize_text(
  content: str,
  chunk_size = 4000,
  summarized_chunk_size = 1024
) -> str:
  """
  Summarizes the given text content using the HuggingFace summarization pipeline,
  if the text is longer than the attention window of the summarization model,
  the text is split into chunks and each chunk is summarized separately.
  :param content: The text content to summarize.
  :param chunk_size: The maximum length of chunks.
  :param summarized_chunk_size: The maximum length of summarized chunks.
  """
  cleaned_content = clean_text(content)
  chunks = chunk_text(cleaned_content, chunk_size)
  summaries = []
  
  # Summarize each chunk separately.
  for idx, chunk in enumerate(chunks):
    print(f'Processing chunk {idx + 1} of {len(chunks)}...')
    summaries.append(
      summarize_chunk(chunk, summarized_chunk_size)
    )
  
  # Return the aggregated summary.
  return '\n\n'.join(summaries)
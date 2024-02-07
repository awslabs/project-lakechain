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

from typing import List
from summarizer import Summarizer
from nlpretext import Preprocessor

# The Bert summarization model.
model = Summarizer()

# An array of characters identifying the lines
# that should be filtered out from the text.
# For example, ASCII tables are not relevant for
# the summarization process.
chars_to_filter = ['+', '╒', '│', '╘', '╞', '├', '|', '[', ']', '…']

def filter_lines(text: str, filters: List[str]) -> str:
  """
  Filters out lines from the text string that start with any of the given characters set.
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


def summarize_text(content: str, ratio = 0.2) -> str:
  """
  Summarizes the given text content using the Bert extractive summarization model.
  :param content: The text content to summarize.
  :param ratio: The ratio of the text to summarize, between 0.1 and 1.0.
  """
  cleaned_content = clean_text(content)
  return ''.join(
    model(cleaned_content, ratio=ratio)
  )
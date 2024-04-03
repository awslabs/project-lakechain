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
import whisper

from typing import BinaryIO, Union
from io import StringIO
from threading import Lock

# Importing output transforms.
from whisper.utils import (
  ResultWriter,
  WriteTXT,
  WriteSRT,
  WriteVTT,
  WriteTSV,
  WriteJSON
)

# The OpenAI Whisper model uses the official OpenAI Whisper
# library based on PyTorch to perform transcriptions of
# audio files.
class OpenAIWhisper:
  def __init__(self):
    self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
    self.model_name = os.getenv('WHISPER_MODEL', 'small')
    self.cache_dir = os.environ.get('CACHE_DIR')
    self.model = whisper.load_model(self.model_name, device=self.device, download_root=self.cache_dir)
    self.lock = Lock()    

  def transcribe(self, file_path: str, output: str = 'vtt', language: Union[str, None] = None):
    """
    Uses the OpenAI Whisper model to generate a transcript
    of the given audio input, in the given output format.
    :param file_path: The audio file input to transcribe.
    :param output: The output format to use (e.g. 'srt', 'vtt', 'tsv', 'json', 'txt').
    :param language: An optional language to use for transcription (e.g. 'en', 'es', 'fr').
    :return: A stream containing the formatted transcript, and the language of the transcript.
    """
    options_dict = {'task' : 'transcribe'}
    if language:
      options_dict['language'] = language
    
    with self.lock:
      result = self.model.transcribe(file_path, **options_dict)

    outputFile = StringIO()
    self.write_result(result, outputFile, output)
    outputFile.seek(0)
    return outputFile, result['language']

  def write_result(self, result: dict, file: BinaryIO, output: str):
    """
    Formats the given result into the given output format
    and writes it to the given stream.
    :param result: The result of a transcription to format.
    :param file: The stream to write the formatted result to.
    :param output: The output format to use (e.g. 'srt', 'vtt', 'tsv', 'json', 'txt').
    """
    opts = { 'max_line_width': 1000, 'max_line_count': 10, 'highlight_words': False }
    if(output == 'srt'):
      WriteSRT(ResultWriter).write_result(result, file=file, options=opts)
    elif(output == 'vtt'):
      WriteVTT(ResultWriter).write_result(result, file=file, options=opts)
    elif(output == 'tsv'):
      WriteTSV(ResultWriter).write_result(result, file=file, options=opts)
    elif(output == 'json'):
      WriteJSON(ResultWriter).write_result(result, file=file, options=opts)
    elif(output == 'txt'):
      WriteTXT(ResultWriter).write_result(result, file=file, options=opts)
    else:
      raise ValueError(f'Unsupported output format: {output}')

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

from typing import BinaryIO, Optional
from io import StringIO
from faster_whisper import WhisperModel

# Importing output transforms.
from .utils import (
  ResultWriter,
  WriteTXT,
  WriteSRT,
  WriteVTT,
  WriteTSV,
  WriteJSON
)

# The Faster Whisper model uses the faster_whisper library
# to perform transcriptions of audio files.
# See https://github.com/guillaumekln/faster-whisper
class FasterWhisper:
  def __init__(self):
    self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
    self.model_name = os.getenv('WHISPER_MODEL', 'small')
    self.cache_dir = os.environ.get('CACHE_DIR')
    model_path = os.path.join(self.cache_dir, '.cache', 'faster_whisper', self.model_name)
    self.model = WhisperModel(
      self.model_name,
      device=self.device,
      compute_type='float32' if torch.cuda.is_available() else 'int8',
      download_root=model_path
    )

  def transcribe(self, file_path: str, output: str = 'vtt', language: Optional[str] = None):
    """
    Uses the Faster Whisper model to generate a transcript
    of the given audio input, in the given output format.
    :param file_path: The audio file to transcribe.
    :param output: The output format to use (e.g. 'srt', 'vtt', 'tsv', 'json', 'txt').
    :param language: The language to use for transcription (e.g. 'en', 'es', 'fr').
    """
    options_dict = {'task' : 'transcribe'}
    if language:
      options_dict['language'] = language
    segments = []
    text     = ""
    
    segment_generator, info = self.model.transcribe(file_path, beam_size=5, **options_dict)
    for segment in segment_generator:
      segments.append(segment)
      text = text + segment.text
    
    result = {
      'language': options_dict.get('language', info.language),
      'segments': segments,
      'text': text
    }

    outputFile = StringIO()
    self.write_result(result, outputFile, output)
    outputFile.seek(0)
    return outputFile, result['language']

  def write_result(self, result: dict, file: BinaryIO, output: str):
      if output == "srt":
          WriteSRT(ResultWriter).write_result(result, file = file)
      elif output == "vtt":
          WriteVTT(ResultWriter).write_result(result, file = file)
      elif output == "tsv":
          WriteTSV(ResultWriter).write_result(result, file = file)
      elif output == "json":
          WriteJSON(ResultWriter).write_result(result, file = file)
      elif output == "txt":
          WriteTXT(ResultWriter).write_result(result, file = file)
      else:
          raise ValueError(f"Unsupported output format: {output}")

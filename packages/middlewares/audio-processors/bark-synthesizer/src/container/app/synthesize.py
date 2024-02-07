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
import nltk
import pydub
import numpy as np

from typing import List
from bark.api import semantic_to_waveform
from bark import SAMPLE_RATE, preload_models
from bark.generation import generate_text_semantic

# Environment variables.
CACHE_DIR = os.getenv('CACHE_DIR')

# Preload the models.
preload_models()

# Download the nltk punkt tokenizer and set
# the download directory.
nltk.data.path.append(CACHE_DIR)
nltk.download('punkt', download_dir=CACHE_DIR)

# The length of silence added between sentences.
SILENCE = 0.1

def split_text(document: str) -> List[str]:
  """
  Splits the text into discrete sentences.
  :param document: The document to split.
  :return: A list of sentences.
  """
  text = document.replace('\n', ' ').strip()
  return nltk.sent_tokenize(text)


def np_to_mp3(x: np.ndarray, bitrate: str = "320k") -> bytes:
  """
  Converts the given numpy array to an MP3 file.
  :param output_file: The output file to write to.
  :param x: The numpy array to convert.
  :param bitrate: The bitrate of the output MP3.
  """
  buffer = io.BytesIO()
  channels = 2 if (x.ndim == 2 and x.shape[1] == 2) else 1
  y = np.int16(x * 2 ** 15)
  song = pydub.AudioSegment(y.tobytes(), frame_rate=SAMPLE_RATE, sample_width=2, channels=channels)
  song.export(buffer, format="mp3", bitrate=bitrate)
  return buffer.getvalue()


def synthesize_text(document: str, voice: str, temperature: float = 0.5):
  """
  Synthesizes into audio the given `document`.
  :param document: The document to synthesize.
  :param voice: The voice to use by the Bark model.
  :param temperature: The temperature to use when generating text.
  """
  pieces    = []
  sentences = split_text(document)

  # We synthesize each sentence individually.
  for sentence in sentences:
    semantic_tokens = generate_text_semantic(
      sentence,
      history_prompt=voice,
      temp=temperature,
      min_eos_p=0.05
    )
    audio_array = semantic_to_waveform(semantic_tokens, history_prompt=voice)
    pieces += [audio_array, np.zeros(int(SILENCE * SAMPLE_RATE)).copy()]
  
  # Concatenate the pieces together.
  audio = np.concatenate(pieces)

  # Convert the audio to an MP3 file.
  return np_to_mp3(audio)

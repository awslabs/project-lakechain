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
import random

from typing import Union

# Environment variables.
BARK_VOICES       = json.loads(open('app/voices.json', 'r').read())
VOICE_MAPPING     = json.loads(os.getenv('VOICE_MAPPING', '{}'))
LANGUAGE_OVERRIDE = os.getenv('LANGUAGE_OVERRIDE', None)

def get_language(event: dict) -> str:
  """
  Attempts to infer the language to use given any language
  override, and the language of the source document.
  :param event: The event to process.
  :return: The language to use, or 'en' if it could not be inferred.
  """
  metadata = event['data']['metadata']

  # If there is a language override, we always use it.
  if LANGUAGE_OVERRIDE:
    return LANGUAGE_OVERRIDE
  
  # If there is a language in the metadata properties, we use it.
  if 'language' in metadata:
    return metadata['language']
  
  return 'en'


def get_voice_from_mapping(language: str) -> Union[str, None]:
  """
  :param language: The language to use to infer a voice.
  :return: The voice to use for the given language,
  or None if it could not be inferred.
  """
  voices_for_language = VOICE_MAPPING.get(language, None)
  if voices_for_language:
    return random.choice(voices_for_language)
  return None


def get_voice_from_bark(language: str) -> Union[str, None]:
  """
  :param language: The language to use to infer a voice.
  :return: The voice to use for the given language,
  or None if it could not be inferred.
  """
  matching_voices = [item for item in BARK_VOICES if item['LanguageCode'] == language]
  if len(matching_voices) > 0:
    return random.choice(matching_voices)['Id']
  return None


def get_voice(event: dict) -> Union[str, None]:
  """
  Returns the voice to use for the given language.
  :param event: The event associated with the source document.
  """
  language = get_language(event)

  # We first try to infer the voices to use from the voice mapping.
  voice = get_voice_from_mapping(language)
  if voice:
    return voice
  
  # If a voice could not be inferred from the mapping, we try to
  # infer it from the bark supported voices.
  return get_voice_from_bark(language)

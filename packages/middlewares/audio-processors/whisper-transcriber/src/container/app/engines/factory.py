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
import logging

# Environment variables.
WHISPER_ENGINE = os.environ.get('WHISPER_ENGINE', 'openai_whisper')

def create_engine():
  # The Whisper engine to use is defined by an environment
  # variable and is set by default to the default OpenAI
  # based implementation.
  if WHISPER_ENGINE == 'faster_whisper':
    logging.info('Using the Faster Whisper implementation')
    from engines.faster_whisper.core import FasterWhisper
    return FasterWhisper()
  elif WHISPER_ENGINE == 'openai_whisper':
    logging.info('Using the OpenAI Whisper implementation')
    from engines.openai_whisper.core import OpenAIWhisper
    return OpenAIWhisper()
  else:
    raise Exception(f'Invalid ASR engine: {WHISPER_ENGINE}')
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

from pydantic import BaseModel
from enum import Enum
from typing import Optional

# A mapping between output formats and their
# associated MIME types.
class OutputFormats(str, Enum):
  srt  = 'application/x-subrip'
  vtt  = 'text/vtt'
  tsv  = 'text/tab-separated-values'
  json = 'application/json'
  txt  = 'text/plain'

# The possible output formats for a transcription.
class TranscriptionOutput(str, Enum):
  srt  = 'srt'
  vtt  = 'vtt'
  tsv  = 'tsv'
  json = 'json'
  txt  = 'txt'

  # Return the MIME type associated with the output format.  
  def as_mime_type(self) -> str:
    return OutputFormats[self.value].value

# Define a Pydantic model for a transcription.
class TranscriptionInput(BaseModel):
  s3_bucket: str
  s3_key: str  
  etag: str
  output: TranscriptionOutput = 'vtt'
  language: Optional[str] = None

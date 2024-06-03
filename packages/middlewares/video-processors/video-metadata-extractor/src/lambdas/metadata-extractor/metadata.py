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

import dateutil.parser as parser
from pymediainfo import MediaInfo

def parse_video_track(track, metadata: dict):
  """
  Extracts the metadata from the given video track.
  :param track:     The video track to extract the metadata from.
  :param metadata:  The metadata to enrich.
  """
  attrs = metadata['properties']['attrs']
  if isinstance(track.frame_rate, str):
    attrs['fps'] = float(track.frame_rate)
  if isinstance(track.width, int) and isinstance(track.height, int):
    attrs['resolution'] = {
      'width': track.width,
      'height': track.height
    }
  if isinstance(track.format, str):
    attrs['format'] = track.format
  if isinstance(track.duration, int):
    attrs['duration'] = track.duration
  if isinstance(track.codec_id, str):
    attrs['codec'] = track.codec_id
  if isinstance(track.pixel_aspect_ratio, str):
    attrs['aspectRatio'] = float(track.pixel_aspect_ratio)
  if isinstance(track.encoded_date, str):
    metadata['createdAt'] = parser.parse(track.encoded_date).isoformat()


def parse_audio_track(track, metadata: dict):
  """
  Extracts the metadata from the given audio track.
  :param track:     The audio track to extract the metadata from.
  :param metadata:  The metadata to enrich.
  """
  attrs = metadata['properties']['attrs']
  audio = {}
  if isinstance(track.codec_id, str):
    audio['codec'] = track.codec_id
  if isinstance(track.duration, int):
    audio['duration'] = track.duration
  if isinstance(track.bit_rate, int):
    audio['bitrate'] = track.bit_rate
  if isinstance(track.channel_s, int):
    audio['channels'] = track.channel_s
  if isinstance(track.sampling_rate, int):
    audio['sampleRate'] = track.sampling_rate
  if isinstance(track.language, str):
    metadata['language'] = track.language
  if isinstance(track.compression_mode, str):
    if track.compression_mode == 'Lossy':
      audio['lossless'] = False
    elif track.compression_mode == 'Lossless':
      audio['lossless'] = True
  attrs['audioTracks'].append(audio)


def get_metadata(video_url: str):
  """
  Extracts the metadata from the given video file.
  :param video_url:   URL of the video file.
  :return:            Metadata of the video file.
  """
  media_info = MediaInfo.parse(video_url, library_file='/opt/python/libmediainfo.so.0')
  metadata = {
    'properties': {
      'kind': 'video',
      'attrs': {
        'audioTracks': []
      }
    }
  }
  
  for track in media_info.tracks:
    if track.track_type == 'Video':
      parse_video_track(track, metadata)
    elif track.track_type == 'Audio':
      parse_audio_track(track, metadata)

  return metadata
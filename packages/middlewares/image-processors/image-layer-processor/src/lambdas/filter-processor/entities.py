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

import boto3
import json
from urllib.parse import urlparse, unquote

# Runtime function attributes.
s3_client = boto3.client('s3')

def load_from_cache(url: str) -> bytes:
  """
  Loads an object from the given `url` in memory.
  :param url: The URL of the object to load.
  :return: The object loaded in memory.
  """
  parsed_url = urlparse(url)
  bucket     = unquote(parsed_url.netloc)
  key        = unquote(parsed_url.path).lstrip('/')
  response   = s3_client.get_object(Bucket=bucket, Key=key)
  return response['Body'].read()


def get_metadata_attrs(event: dict) -> dict:
  """
  :param event: The event to retrieve the attributes from.
  :return: the attributes associated with the given image.
  If no attributes are found, an empty dict is returned.
  """
  attrs = event\
      .get('data', {})\
      .get('metadata', {})\
      .get('properties', {})\
      .get('attrs', None)
  return attrs if isinstance(attrs, dict) else {}


def get_faces(event: dict) -> list:
  """
  :param event: The event to retrieve the faces from.
  :return: the faces associated with the given image.
  If no faces are found, an empty list is returned.
  """
  faces_url = get_metadata_attrs(event).get('faces', None)
  if not faces_url or not isinstance(faces_url, str):
    return []
  return json.loads(load_from_cache(faces_url))


def get_objects(event: dict) -> list:
  """
  :param event: The event to retrieve the objects from.
  :return: the objects associated with the given image.
  If no objects are found, an empty list is returned.
  """
  objects_url = get_metadata_attrs(event).get('objects', None)
  if not objects_url or not isinstance(objects_url, str):
    return []
  return json.loads(load_from_cache(objects_url))


def get_text_areas(event: dict) -> list:
  """
  :param event: The event to retrieve the text areas from.
  :return: the text areas associated with the given image.
  If no text areas are found, an empty list is returned.
  """
  text_areas_url = get_metadata_attrs(event).get('text', None)
  if not text_areas_url or not isinstance(text_areas_url, str):
    return []
  return json.loads(load_from_cache(text_areas_url))

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

import cv2
import numpy as np
from entities import get_faces, get_objects, get_text_areas

def get_image_dimensions(event: dict):
  """
  :param event: The event associated with the image.
  :return: the dimensions of the image.
  """
  dimensions = event.get('data', {})\
    .get('metadata', {})\
    .get('properties', {})\
    .get('attrs', {})\
    .get('dimensions', None)
  if not isinstance(dimensions, dict) or not dimensions.get('width') or not dimensions.get('height'):
    return None
  return dimensions


def draw_bounding_box(np_array: np.ndarray, bounding_box: dict, text: str = ''):
  """
  Draws a bounding box on the given image at the given coordinates.
  :param np_array: the image to draw on.
  :param bounding_box: the coordinates of the bounding box.
  :param text: an optional text to display on the bounding box.
  """
  height, width = np_array.shape[:2]
  
  # The coordinates of the bounding box relative to the image dimensions.
  left   = int(bounding_box['left'] * width)
  top    = int(bounding_box['top'] * height)
  right  = int(bounding_box['width'] * width) + left
  bottom = int(bounding_box['height'] * height) + top
  
  # Thickness and font scale are proportional to the image dimensions.
  diagonal_length = np.sqrt(height**2 + width**2)
  font_scale = diagonal_length * 0.0005
  thickness = int(font_scale) if int(font_scale) > 1 else 1
  
  # Draw the bounding box.
  cv2.rectangle(np_array, (left, top), (right, bottom), (0, 0, 255), thickness)
  
  # Draw the text.
  if text and len(text) > 0:
    cv2.putText(np_array, text, (left, top - 20), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 255), thickness)


def draw_point(np_array: np.ndarray, x: float, y: float, color=(0, 0, 255)):
  """
  Draws a point on the given image at the given coordinates,
  using a radius that is proportional to the image dimensions.
  :param np_array: the image to draw on.
  :param x: the x coordinate of the point.
  :param y: the y coordinate of the point.
  :param color: the color of the point.
  """
  height, width = np_array.shape[:2]
  diagonal_length = np.sqrt(height**2 + width**2)
  radius = int(diagonal_length * 0.001)
  cv2.circle(np_array, (int(x * width), int(y * height)), radius, color, thickness=-1)


def highlight_faces(image: np.ndarray, event: dict):
  """
  Applies a highlight filter to the faces
  in the given image.
  :param image: The image to process.
  :param event: The event associated with the image.
  """
  faces = get_faces(event)
  for face in faces:
    draw_bounding_box(image, face['boundingBox'])
  return image


def highlight_objects(image: np.ndarray, event: dict):
  """
  Applies a highlight filter to the objects
  in the given image.
  :param image: The image to process.
  :param event: The event associated with the image.
  """
  objects = get_objects(event)
  for obj in objects:
    draw_bounding_box(image, obj['boundingBox'], obj['name'] if 'name' in obj else '')
  return image


def highlight_text_areas(image: np.ndarray, event: dict):
  """
  Applies a highlight filter to the text areas
  in the given image.
  :param image: The image to process.
  :param event: The event associated with the image.
  """
  text_areas = get_text_areas(event)
  for text_area in text_areas:
    draw_bounding_box(image, text_area['boundingBox'])
  return image


def highlight_landmarks(image: np.ndarray, event: dict):
  """
  Applies a highlight filter to the landmarks
  in the given image.
  :param image: The image to process.
  :param event: The event associated with the image.
  """
  faces = get_faces(event)
  
  for face in faces:
    if 'landmarks' in face:
      for landmark in face['landmarks']:
        draw_point(image, landmark['x'], landmark['y'], (255, 255, 255))

  return image
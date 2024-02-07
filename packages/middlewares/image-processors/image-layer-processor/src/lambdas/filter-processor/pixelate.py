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

def pixelate(image: np.ndarray, blocks = 10):
  (h, w) = image.shape[:2]
  xSteps = np.linspace(0, w, blocks + 1, dtype="int")
  ySteps = np.linspace(0, h, blocks + 1, dtype="int")
	
  # Loop over the blocks in both the x and y direction.
  for i in range(1, len(ySteps)):
    for j in range(1, len(xSteps)):
      # Compute the starting and ending (x, y)-coordinates
      # for the current block.
      startX    = xSteps[j - 1]
      startY    = ySteps[i - 1]
      endX      = xSteps[j]
      endY      = ySteps[i]
      roi       = image[startY:endY, startX:endX]
      (B, G, R) = [int(x) for x in cv2.mean(roi)[:3]]
      cv2.rectangle(image, (startX, startY), (endX, endY), (B, G, R), -1)

  return image


def pixelate_bounding_box(np_array: np.ndarray, bounding_box: dict):
  height, width = np_array.shape[:2]
  
  # The coordinates of the face bounding box,
  # relative to the image dimensions.
  x = int(bounding_box['left'] * width)
  y = int(bounding_box['top'] * height)
  w = int(bounding_box['width'] * width)
  h = int(bounding_box['height'] * height)
  
  # The region of interest (ROI) is the face bounding box.
  np_array[y:y+h, x:x+w] = pixelate(np_array[y:y+h, x:x+w])


def pixelate_faces(image: np.ndarray, event: dict):
  """
  Applies a pixelation filter to the faces
  in the given image.
  :param image: The image to process.
  :param event: The event associated with the image.
  """
  faces = get_faces(event)
  
  if len(faces) > 0:
    for face in faces:
      pixelate_bounding_box(image, face['boundingBox'])

  return image


def pixelate_objects(image: np.ndarray, event: dict):
  """
  Applies a pixelation filter to the objects
  in the given image.
  :param image: The image to process.
  :param event: The event associated with the image.
  """
  objects = get_objects(event)
  
  if len(objects) > 0:
    for obj in objects:
      pixelate_bounding_box(image, obj['boundingBox'])

  return image


def pixelate_text_areas(image: np.ndarray, event: dict):
  """
  Applies a pixelation filter to the text areas
  in the given image.
  :param image: The image to process.
  :param event: The event associated with the image.
  """
  text_areas = get_text_areas(event)
  
  if len(text_areas) > 0:
    for text_area in text_areas:
      pixelate_bounding_box(image, text_area['boundingBox'])

  return image
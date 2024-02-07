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
import copy

from PIL import Image
from transformers import AutoProcessor, Blip2ForConditionalGeneration

# The device used for inference.
device = 'cuda' if torch.cuda.is_available() else 'cpu'

# Environment variables.
CACHE_DIR = os.environ.get('CACHE_DIR')

# Load the BLIP2 model.
processor = AutoProcessor.from_pretrained('Salesforce/blip2-opt-2.7b', cache_dir=CACHE_DIR)
model = Blip2ForConditionalGeneration.from_pretrained('Salesforce/blip2-opt-2.7b', cache_dir=CACHE_DIR).to(device)

def get_description(image: Image, max_length = 256) -> str:
  """
  :param image: the image to generate a description for.
  :param max_length: the maximum length of the description.
  :return: a description associated with the given image.
  """
  inputs = processor(image, return_tensors='pt').to(device)
  generated_ids = model.generate(**inputs, max_new_tokens=max_length)
  return processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()


def get_metadata_from_image(event: dict, image: Image) -> dict:
  """
  Computes a description for the given image and stores it
  in the description field of the document metadata.
  :event: the CloudEvent associated with the image.
  :image: the image loaded in memory.
  :returns: a dictionary containing the extracted metadata.
  """
  metadata = copy.deepcopy(event['data']['metadata'])
  
  # Computing a description for the image.
  description = get_description(image, max_length=256)
  if len(description) > 0:
    metadata['description'] = description
  
  # Setting the document-specific properties if they don't exist.
  if 'properties' not in metadata:
    metadata['properties'] = {
      'kind': 'image',
      'attrs': {}
    }
  
  # Setting the image properties.
  metadata['properties']['attrs'] |= {
    'dimensions': {
      'width': image.width,
      'height': image.height
    }
  }
  
  return metadata

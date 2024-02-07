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
import clip
import torch.nn.functional as F

from PIL import Image
from class_labels import class_labels

# The CLIP model to use for generating the embeddings.
CLIP_MODEL = os.environ.get('CLIP_MODEL', 'ViT-B/32')
CACHE_DIR  = os.environ.get('CACHE_DIR')

# Select the appropriate device to run the model on
# based on the availability of CUDA and MPS.
device = 'cuda' if torch.cuda.is_available() else \
  ('mps' if torch.backends.mps.is_available() else 'cpu')

# Loading the CLIP model.
model, processor = clip.load(CLIP_MODEL, device=device, download_root=CACHE_DIR)

def create_image_embeddings(image: Image):
    """
    Loads the specifed image using its path, and generates
    the image embeddings for the image.
    :param image_path: The path to the image to load.
    :return: The image and its embeddings.
    """
    image_input = processor(image).unsqueeze(0).to(device)
    with torch.no_grad():
      image_features = model.encode_image(image_input)
    return image_features


def create_label_embeddings():
    """
    Generates the text embeddings for the class labels
    in batch. This function is used to precompute the
    embeddings for the class labels that will later be
    used to generate the top labels for the images.
    :return: The text embeddings for the class labels.
    """
    text_inputs = torch.cat([
      clip.tokenize(f"a photo of a {label}") for label in class_labels
    ]).to(device)

    with torch.no_grad():
      return model.encode_text(text_inputs)


def get_top_labels(image_embeddings, top=5):
    """
    :param image_embeddings: The image embeddings to use for
    generating the top labels.
    :param top: The number of most similar labels to return.
    :return: The top labels for the image.
    """
    cosine_similarities = F.cosine_similarity(image_embeddings, text_embeddings)
    _, indices = torch.topk(cosine_similarities, top)
    return [class_labels[i] for i in indices.tolist()]

# Precompute the embeddings for the class labels
# and cache them in memory.
text_embeddings = create_label_embeddings()

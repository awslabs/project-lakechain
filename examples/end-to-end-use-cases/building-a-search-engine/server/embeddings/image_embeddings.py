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

# The CLIP model to use for generating the embeddings.
CLIP_MODEL = os.environ.get('CLIP_MODEL', 'ViT-B/32')

# Select the appropriate device to run the model on
# based on the availability of CUDA and MPS.
device = 'cpu'

# Loading the CLIP model.
model, processor = clip.load(CLIP_MODEL, device=device)

def clip_create_text_embeddings(text: str):
  """
  Generates text embeddings for the given text.
  :return: The text embeddings for the given text.
  """
  with torch.no_grad():
    encoded_text = model.encode_text(clip.tokenize(text))
    return encoded_text.cpu().numpy().tolist()[0]

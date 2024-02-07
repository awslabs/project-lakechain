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
import numpy as np
import torch
import librosa

from panns_inference import AudioTagging

# Environment variables.
CACHE_DIR    = os.environ.get('CACHE_DIR')
CACHED_MODEL = os.path.join(CACHE_DIR, 'panns')

# Select the appropriate device to run the model on
# based on the availability of CUDA and MPS.
device = 'cuda' if torch.cuda.is_available() else \
  ('mps' if torch.backends.mps.is_available() else 'cpu')

# Load the PANNs model into the GPU.
model = AudioTagging(checkpoint_path=CACHED_MODEL, device=device)

# Function to normalize a vector. Normalizing a vector 
# means adjusting the values measured in different scales 
# to a common scale.
def normalize(v):
  """
  Normalizes a vector.
  :param v: The vector to normalize.
  :return: The normalized vector.
  """
  norm = np.linalg.norm(v)
  if norm == 0: 
    return v
  return v / norm


def create_embeddings(audio: bytes):
  """
  Computes the embeddings for an audio file.
  :param audio: The audio bytes.
  :return: an array of vectors.
  """

  # Load the audio file using librosa's load function,
  # which returns an audio time series and its corresponding sample rate.
  a, _ = librosa.load(audio, sr=44100)
  
  # Reshape the audio time series to have an extra dimension,
  # which is required by the model's inference function.
  query_audio = a[None, :]
  
  # Perform inference on the reshaped audio using the model.
  # This returns an embedding of the audio. 
  _, emb = model.inference(query_audio)

  # Normalize the embedding.
  # This scales the embedding to have a length (magnitude) of 1,
  # while maintaining its direction.
  normalized_v = normalize(emb[0])

  return normalized_v.tolist()

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

import io
import numpy as np
from PIL import Image

# A dictionary of MIME types to PIL formats.
mime_type_to_pil_format = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/gif': 'GIF'
}

def array_to_image(array: np.ndarray, mime_type: str):
  """
  Converts a Numpy array into an RGB image.
  :param array: The Numpy array to convert.
  :param mime_type: The MIME type to convert the image to.
  :return: The image as a byte array and its MIME type.
  """
  format = mime_type_to_pil_format.get(mime_type, 'JPEG')
  img = Image.fromarray(array, 'RGB')
  bytes_io = io.BytesIO()
  img.save(bytes_io, format=format)
  return bytes_io.getvalue(), mime_type if format != 'JPEG' else 'image/jpeg'

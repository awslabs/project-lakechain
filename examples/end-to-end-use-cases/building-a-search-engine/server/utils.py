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
from botocore import client
from urllib.parse import urlparse, unquote

def presign_url(s3_url: str, region: str):
  """
  Generates a presigned URL for the given S3 URL.
  :param s3_url: The S3 URL to generate a presigned URL for.
  :param region: The AWS region.
  :return: The presigned URL.
  """
  s3 = boto3.client('s3',
    endpoint_url=f'https://s3.{region}.amazonaws.com',
    config=client.Config(signature_version='s3v4')
  )

  # Parse the S3 URL.
  s3_url = urlparse(s3_url)

  # URL decode the components of the S3 key.
  key_parts = s3_url.path.lstrip('/').split('/')
  encoded_key_parts = [unquote(part) for part in key_parts]
  encoded_key = '/'.join(encoded_key_parts)

  # Generate the presigned URL.
  return s3.generate_presigned_url(
    ClientMethod='get_object',
    Params={
      'Bucket': s3_url.netloc,
      'Key': encoded_key
    },
    ExpiresIn=3600
  )

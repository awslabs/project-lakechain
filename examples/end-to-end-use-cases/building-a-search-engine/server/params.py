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
import boto3

# The AWS session.
session = boto3.session.Session()

# Environment variables.
es_hostname = os.getenv('OPENSEARCH_HOSTNAME')
es_port = os.getenv('OPENSEARCH_PORT', 443)
aws_region = os.getenv('AWS_REGION', session.region_name)
bedrock_region = os.getenv('BEDROCK_REGION', 'us-east-1')

if not es_hostname:
  # Use a more specific exception class, other than
  raise EnvironmentError('OPENSEARCH_HOSTNAME environment variable is not set.')

if not aws_region:
  raise EnvironmentError('AWS_REGION environment variable is not set.')

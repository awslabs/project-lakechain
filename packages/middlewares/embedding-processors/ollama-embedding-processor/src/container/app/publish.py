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
import json
import aioboto3
from aws_lambda_powertools import Logger

# Environment variables.
SERVICE_NAME     = os.getenv('POWERTOOLS_SERVICE_NAME')
SNS_TARGET_TOPIC = os.getenv('SNS_TARGET_TOPIC')

# Logger.
logger = Logger(service=SERVICE_NAME)

async def publish_event(event: dict):
  """
  Publish the given event to the SNS topic
  for the next middleware to process.
  :param event: The event to publish.
  """
  async with aioboto3.Session().client('sns') as sns_client:
    # Update the call stack with the current service name.
    event['data']['callStack'].insert(0, SERVICE_NAME)

    if SNS_TARGET_TOPIC:
      logger.info(event)
      
      # Publish the event to the SNS topic.
      await sns_client.publish(
        TopicArn=SNS_TARGET_TOPIC,
        Message=json.dumps(event)
      )
    
    return (event)

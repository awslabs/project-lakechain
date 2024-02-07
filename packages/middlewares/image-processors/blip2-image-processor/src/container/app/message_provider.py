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

import logging
import boto3
from typing import Callable

# Runtime variables.
sqs_client = boto3.client('sqs')

def sqs_consume_queue(queue_url: str, message_processor: Callable):
    """
    Poll messages from the input queue and execute
    processing jobs. This function will continuously
    poll messages as long as the queue returns messages.
    :param queue_url: The URL of the SQS queue.
    :param message_processor: The function to call back for each message.
    """
    
    while True:
      # We first try to poll for new messages from the SQS queue.
      messages = sqs_client.receive_message(
        QueueUrl=queue_url,
        MaxNumberOfMessages=1,
        WaitTimeSeconds=20
      ).get('Messages', [])
      
      if len(messages) > 0:
        # Processing each event sequentially.
        for message in messages:
          try:
            message_processor(message)
          except Exception as e:
            logging.error(e)
      else:
        break

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
import sys
import json
import pypandoc
import boto3
import tempfile

from typing import Optional
from urllib.parse import urlparse, unquote
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.data_classes import event_source, SQSEvent
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.data_classes.sqs_event import SQSRecord
from publish import publish_event
from mime_types import (
  mime_type_to_input_format,
  input_format_to_output_formats,
  get_options_for_input
)

from aws_lambda_powertools.utilities.batch import (
  BatchProcessor,
  EventType,
  process_partial_response
)

# Environment variables.
SERVICE_NAME  = os.getenv('POWERTOOLS_SERVICE_NAME')
TARGET_BUCKET = os.getenv('PROCESSED_FILES_BUCKET')

# Runtime function attributes.
s3_client = boto3.client('s3')
logger    = Logger(service=SERVICE_NAME)
tracer    = Tracer(service=SERVICE_NAME)
processor = BatchProcessor(event_type=EventType.SQS)


def load_document(url: str) -> bytes:
    """
    Loads the document from the S3 bucket in memory.
    :param url: The URL of the document to load.
    :return: The document content.
    """
    parsed_url = urlparse(url)
    bucket     = unquote(parsed_url.netloc)
    key        = unquote(parsed_url.path).lstrip('/')
    response   = s3_client.get_object(Bucket=bucket, Key=key)
    return response['Body'].read()


def process_document(
    event: dict,
    content: bytes,
    src_type: str,
    output_type: dict,
    options: list = []
) -> dict:
    """
    Converts the document associated with the given event
    to the given output format(s), and publishes the result(s) to the
    next middlewares.
    :param event: the received cloud event.
    :param content: the document content.
    :param src_type: the source document format.
    :param output_type: the output document format.
    """
    event      = json.loads(json.dumps(event))
    document   = event['data']['document']
    chain_id   = event['data']['chainId']
    extension  = f".{output_type['ext']}"
    file_name  = f"{document['etag']}{extension}"
    output_key = os.path.join(chain_id, file_name)

    # We use a temporary file to store the converted document
    # before uploading it to the middleware internal storage.
    with tempfile.NamedTemporaryFile(dir='/tmp', suffix=extension) as output_file:
        pypandoc.convert_text(
            source=content,
            to=output_type['name'],
            format=src_type,
            extra_args=options,
            outputfile=output_file.name
        )

        data = output_file.read()

        # Write the new file to the S3 bucket.
        upload_result = s3_client.put_object(
            Bucket=TARGET_BUCKET,
            Key=output_key,
            Body=data,
            ContentType=output_type['mime_type']
        )

        # Set the new document in the event.
        event['data']['document'] = {
            'url': f"s3://{TARGET_BUCKET}/{output_key}",
            'type': output_type['mime_type'],
            'size': sys.getsizeof(data),
            'etag': upload_result['ETag'].replace('"', '')
        }

    return event


def record_handler(record: SQSRecord, _: Optional[LambdaContext] = None):
    """
    Process the record associated with the SQS event.
    :param record: The SQS record to process.
    :param lambda_context: The Lambda context.
    """
    event    = json.loads(record.body)
    document = event['data']['document']
    content  = load_document(document['url'])

    # Determine the document source format.
    source = mime_type_to_input_format(document['type'])

    # Determine the document output formats.
    outputs = input_format_to_output_formats(source)

    # Get the Pandoc options to use.
    options = get_options_for_input(source)

    # Convert the document to each output format.
    for output in outputs:
        publish_event(
            process_document(event, content, source, output, options)
        )
    
    return True


@logger.inject_lambda_context()
@tracer.capture_lambda_handler
@event_source(data_class=SQSEvent)
def lambda_handler(event: SQSEvent, context: LambdaContext):
    """
    Processes each SQS records with partial failure handling.
    :param event:   The SQS event to process.
    :param context: The Lambda context.
    """
    return process_partial_response(
        event=event,
        record_handler=record_handler,
        processor=processor,
        context=context
    )

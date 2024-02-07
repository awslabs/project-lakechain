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
import pypandoc
import boto3

from typing import Tuple
from urllib.parse import urlparse, unquote
from metadata import get_document_metadata
from pdfminer.converter import TextConverter
from pdfminer.layout import LAParams
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.pdfpage import PDFPage
from pdfminer.pdfparser import PDFParser
from pdfminer.pdfinterp import resolve1

def load_document(url: str) -> bytes:
  """
  Loads the document from the S3 bucket in memory as UTF-8 encoded string.
  :param url: The URL of the document to load.
  :return: The content of the document as bytes.
  """
  s3_client  = boto3.client('s3')
  parsed_url = urlparse(url)
  response   = s3_client.get_object(
    Bucket=unquote(parsed_url.netloc),
    Key=unquote(parsed_url.path).lstrip('/')
  )
  return response['Body'].read()


def clean_document(
  content: str,
  src_type: str = 'markdown',
  dest_type: str = 'plain'
) -> str:
  """
  Uses Pandoc to convert the given file to plain text.
  :param content: The content of the file to convert in bytes.
  :param src_type: The Pandoc type of the source file.
  :param dest_type: The Pandoc type of the destination file.
  :return: The content of the cleaned file as a string.
  """
  # Remove incomplete lines.
  content = "\n\n".join(line.strip() for line in content.split('\n\n') if len(line) > 5)
  # Format the document with Pandoc.
  return pypandoc.convert_text(
    source=content,
    to=dest_type,
    format=src_type,
    extra_args=['--standalone']
  )


def parse_document(url: str) -> Tuple[dict, str]:
  """
  Parses the content of the document pointed by the given URI,
  extracts its associated text and returns its metadata.
  :param url: The URL of the document to parse.
  :return: The metadata of the document and the text associated
  with the document.
  """
  input_stream = io.BytesIO(load_document(url))
  output_stream = io.StringIO()
  parser = PDFParser(input_stream)
  doc = PDFDocument(parser)
  rsrcmgr = PDFResourceManager()
  device = TextConverter(rsrcmgr, output_stream, laparams=LAParams())
  interpreter = PDFPageInterpreter(rsrcmgr, device)
  
  # Convert each page to text.
  for page in PDFPage.create_pages(doc):
    interpreter.process_page(page)
  
  # Retrieve the text.
  text = output_stream.getvalue()

  # Get the number of pages.
  num_pages = resolve1(doc.catalog['Pages'])['Count']
  
  return get_document_metadata(doc, num_pages), clean_document(text)

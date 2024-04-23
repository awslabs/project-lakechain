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

from PIL import Image
from pdfminer.converter import TextConverter
from pdfminer.layout import LAParams
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.pdfpage import PDFPage
from pdfminer.pdfparser import PDFParser
from pdf2image import convert_from_bytes
from pypdf import PdfReader, PdfWriter

def create_document(data: bytes) -> PDFDocument:
  """
  Creates a document in the S3 bucket with the given content.
  :param data: The content of the PDF file.
  """
  input_stream = io.BytesIO(data)
  parser = PDFParser(input_stream)
  return PDFDocument(parser)


def clean_text(
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


def pdf_document_to_text(data: bytes) -> str:
  """
  Parses the content of the document pointed by the given URI,
  and extracts its associated text.
  :param data: The content of the document to parse.
  :return: The text extracted from the document.
  """
  output_stream = io.StringIO()
  doc = create_document(data)
  rsrcmgr = PDFResourceManager()
  device = TextConverter(rsrcmgr, output_stream, laparams=LAParams())
  interpreter = PDFPageInterpreter(rsrcmgr, device)
  
  # Convert each page to text.
  for page in PDFPage.create_pages(doc):
    interpreter.process_page(page)

  return clean_text(output_stream.getvalue())


def pdf_page_to_text(data: bytes, page_number: int) -> str:
  """
  Parses the content of the document pointed by the given URI,
  extracts the text of the specified page and returns it.
  :param data: The content of the document to parse.
  :param page_number: The number of the page to extract.
  :return: The text of the specified page.
  """
  output_stream = io.StringIO()
  doc = create_document(data)
  rsrcmgr = PDFResourceManager()
  device = TextConverter(rsrcmgr, output_stream, laparams=LAParams())
  interpreter = PDFPageInterpreter(rsrcmgr, device)
  
  # Convert each page to text.
  for i, page in enumerate(PDFPage.create_pages(doc)):
    if i == page_number - 1:
      interpreter.process_page(page)
      break

  return clean_text(output_stream.getvalue())


def pdf_document_to_images(data: bytes, dpi=200, output_format='jpeg'):
  """
  Converts the document pointed by the given URI to an image and returns it.
  :param data: The content of the document to parse.
  :param dpi: The resolution of the resulting image.
  :param output_format: The format of the resulting image.
  :return: The image of the specified page.
  """
  images = convert_from_bytes(data, dpi=dpi, fmt=output_format)
  if not images:
    raise ValueError("Conversion failed.")
  return images


def pdf_page_to_image(data: bytes, page_number: int, dpi=200, output_format='jpeg'):
  """
  Converts the specified page of the document pointed by the given URI to an image and returns it.
  :param data: The content of the document to parse.
  :param page_number: The number of the page to extract.
  :param dpi: The resolution of the resulting image.
  :param output_format: The format of the resulting image.
  :return: The image of the specified page.
  """
  images = convert_from_bytes(
    data,
    dpi=dpi,
    fmt=output_format,
    first_page=page_number,
    last_page=page_number
  )
  if not images:
    raise ValueError("Conversion failed.")
  img_byte_arr = io.BytesIO()
  images[0].save(img_byte_arr, format=output_format.upper())
  return img_byte_arr.getvalue()


def pdf_document_to_image(data: bytes, dpi=200, output_format='jpeg'):
  """
  Converts the document pointed by the given URI to a stitched image and returns it.
  :param data: The content of the document to parse.
  :param dpi: The resolution of the resulting image.
  :param output_format: The format of the resulting image.
  :return: The stitched image of the specified page.
  """
  images = pdf_document_to_images(data, dpi=dpi, output_format=output_format)
  
  # Determine the maximum width and the total height.
  max_width = max(image.width for image in images)
  total_height = sum(image.height for image in images)

  # Create a new image with the appropriate size.
  stitched_image = Image.new('RGB', (max_width, total_height))

  # Paste each image into the new image.
  current_y = 0
  for image in images:
    stitched_image.paste(image, (0, current_y))
    current_y += image.height

  # Save the stitched image.
  img_byte_arr = io.BytesIO()
  stitched_image.save(img_byte_arr, format=output_format.upper())
  return img_byte_arr.getvalue()


def pdf_document_to_pdf_page(data: bytes, page_number: int):
  """
  Extracts the specified page of the document pointed by the given URI and returns it.
  :param data: The content of the document to parse.
  :param page_number: The number of the page to extract.
  :return: The content of the specified page.
  """
  doc = create_document(data)
  pages = PDFPage.create_pages(doc)
  for i, page in enumerate(pages):
    if i == page_number - 1:
      return page
  raise ValueError(f"Invalid page number: {page_number}")


def pdf_document_to_page(data: bytes, page_number: int):
    """
    Extracts the specified page of the document provided in data and saves it as a new PDF document.
    :param data: The content of the document to parse as a bytes object.
    :param page_number: The number of the page to extract (1-indexed).
    :param output_path: The file path to save the extracted page.
    """
    # Convert bytes data to a file-like object
    bytes_io = io.BytesIO(data)

    # Initialize the PDF reader with the file-like object
    reader = PdfReader(bytes_io)

    # Create a PDF writer for the output file
    writer = PdfWriter()

    # Check if the page number is valid
    if page_number < 1 or page_number > len(reader.pages):
        raise ValueError(f"Invalid page number: {page_number}")

    # Get the specified page and add it to the writer
    page = reader.pages[page_number - 1]  # Extract the page
    writer.add_page(page)  # Add the page to a new PDF

    # Write the new PDF to a byte stream
    output_stream = io.BytesIO()
    writer.write(output_stream)

    return output_stream.getvalue()

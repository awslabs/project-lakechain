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

import feedparser
import hashlib
from bs4 import BeautifulSoup

def get_language_code(input_code: str) -> str:
  """
  Extracts the language code from the given input code.
  CloudEvents currently support two-letter language codes, so we'll
  extract the first two letters from the input code if it's longer.

  Args:
    input_code (str): The input code associated with the feed item.

  Returns:
    str: A two-letter language code.

  """
  input_code = input_code.lower()

  if '-' in input_code or '_' in input_code:
    return input_code.split('-')[0] if '-' in input_code else input_code.split('_')[0]
  return input_code


def get_authors(item: feedparser.util.FeedParserDict) -> list[str]:
  """
  Get the names of the authors from the given feed item.

  Args:
    item (feedparser.util.FeedParserDict): The feed item.

  Returns:
    list: A list of author names.

  """
  authors = item.get('authors', [])
  return [author.name for author in authors if 'name' in author]


def get_description(
  doc: feedparser.util.FeedParserDict,
  max_length: int = 1024
) -> str:
  """
  Get the description from a feed document and truncate it if necessary
  to the given maximum length.

  Args:
    doc (feedparser.util.FeedParserDict): The feed document.
    max_length (int, optional): The maximum length of the description. Defaults to 1024.

  Returns:
    str: The truncated or original description.
  """
  description = BeautifulSoup(doc.get('description', ''), 'html.parser').get_text()
  if len(description) > max_length:
    return f'{description[:max_length]}...'
  return description


def get_feed_item_hash(item: feedparser.util.FeedParserDict) -> str or None:
  """
  A helper function returning the hash associated with a feed item.

  Args:
    item (feedparser.util.FeedParserDict): The feed item.

  Returns:
    str: The ID of the feed item, or None if no ID is found.
  """
  if 'id' in item:
    return hashlib.sha1(
      item.id.encode(),
      usedforsecurity=False
    ).hexdigest()  
  return None


def get_feed_item_metadata(
  item: feedparser.util.FeedParserDict,
  language: str
) -> dict:
  """
  Get the metadata of a feed item.

  Args:
    item (feedparser.util.FeedParserDict): The feed item.
    language (str): The language of the feed item.

  Returns:
    dict: The metadata of the feed item.
  """
  return {
    'title': item.title,
    'description': get_description(item),
    'createdAt': item.published,
    'updatedAt': item.updated,
    'authors': get_authors(item),
    'keywords': [tag.term for tag in item.get('tags', [])],
    'language': language,
    'properties': {
      'kind': 'text',
      'attrs': {}
    }
  }


def on_feed_item(
  language: str,
  item: feedparser.util.FeedParserDict
) -> dict:
  """
  Process a feed item and return its hash, link, and metadata.

  Args:
    language (str): The language of the feed item.
    item (feedparser.util.FeedParserDict): The feed item to process.

  Returns:
    dict: A dictionary containing the hash, link, and metadata of the feed item.
  """
  return {
    'hash': get_feed_item_hash(item),
    'link': item.link,
    'type': 'text/html',
    'metadata': get_feed_item_metadata(item, language)
  }


def parse_feed(url: str) -> list[dict]:
  """
  Parses the given feed URL and processes each post in the feed.

  Args:
    url (str): The URL of the feed to parse.

  Returns:
    None
  """
  doc = feedparser.parse(url)

  # The language code is extracted from the feed description.
  language = get_language_code(
    doc.feed.get('language', '')
  )
  
  return [on_feed_item(
    language=language,
    item=post
  ) for post in doc.entries]

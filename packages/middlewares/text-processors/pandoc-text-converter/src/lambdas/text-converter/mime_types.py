import os
import json
from typing import List

# Holds a map between the input format and output formats
# that we need to convert.
CONVERSION_MAPPING = json.loads(os.getenv('CONVERSION_MAPPING', '{}'))

# A mapping of MIME types to Pandoc input formats.
# This is used to map the MIME types of input documents
# to their Pandoc input format equivalents.
mime_type_to_pandoc_input_format = {
  'application/x-bibtex': 'bibtex',
  'application/docbook+xml': 'docbook',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/json': 'json',
  'application/vnd.oasis.opendocument.text': 'odt',
  'text/html': 'html',
  'application/rtf': 'rtf',
  'application/epub+zip': 'epub',
  'text/csv': 'csv',
  'text/markdown': 'markdown',
  'application/x-tex': 'latex',
  'text/x-rst': 'rst',
  'text/tab-separated-values': 'tsv',
  'text/x-textile': 'textile',
  'application/x-ipynb+json': 'ipynb',
  'text/troff': 'man',
  'application/x-fictionbook+xml': 'fb2',
  'text/x-opml': 'opml',
  'application/x-texinfo': 'texinfo'
}

# A mapping between Pandoc output formats and their associated
# MIME types, names, and file extensions.
pandoc_output_format_to_mime_type = {
  'asciidoc': {
      'name': 'asciidoc',
      'mime_type': 'text/x-asciidoc',
      'ext': 'asciidoc'
  },
  'bibtex': {
      'name': 'bibtex',
      'mime_type': 'application/x-bibtex',
      'ext': 'bibtex'
  },
  'commonmark': {
      'name': 'commonmark',
      'mime_type': 'text/markdown',
      'ext': 'md'
  },
  'context': {
      'name': 'context',
      'mime_type': 'application/x-tex',
      'ext': 'tex'
  },
  'csljson': {
      'name': 'csljson',
      'mime_type': 'application/json',
      'ext': 'json'
  },
  'docbook': {
      'name': 'docbook',
      'mime_type': 'application/docbook+xml',
      'ext': 'docbook'
  },
  'docbook4': {
      'name': 'docbook4',
      'mime_type': 'application/docbook+xml',
      'ext': 'docbook'
  },
  'docbook5': {
      'name': 'docbook5',
      'mime_type': 'application/docbook+xml',
      'ext': 'docbook'
  },
  'docx': {
      'name': 'docx',
      'mime_type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'ext': 'docx'
  },
  'dokuwiki': {
      'name': 'dokuwiki',
      'mime_type': 'text/plain',
      'ext': 'docuwiki'
  },
  'epub': {
      'name': 'epub',
      'mime_type': 'application/epub+zip',
      'ext': 'epub'
  },
  'epub2': {
      'name': 'epub2',
      'mime_type': 'application/epub+zip',
      'ext': 'epub'
  },
  'epub3': {
      'name': 'epub3',
      'mime_type': 'application/epub+zip',
      'ext': 'epub'
  },
  'fb2': {
      'name': 'fb2',
      'mime_type': 'application/x-fictionbook+xml',
      'ext': 'fb2'
  },
  'gfm': {
      'name': 'gfm',
      'mime_type': 'text/markdown',
      'ext': 'md'
  },
  'haddock': {
      'name': 'haddock',
      'mime_type': 'text/x-haddock',
      'ext': 'haddock'
  },
  'html': {
      'name': 'html',
      'mime_type': 'text/html',
      'ext': 'html'
  },
  'html4': {
      'name': 'html4',
      'mime_type': 'text/html',
      'ext': 'html'
  },
  'html5': {
      'name': 'html5',
      'mime_type': 'text/html',
      'ext': 'html'
  },
  'icml': {
      'name': 'icml',
      'mime_type': 'application/xml',
      'ext': 'icml'
  },
  'ipynb': {
      'name': 'ipynb',
      'mime_type': 'application/x-ipynb+json',
      'ext': 'ipynb'
  },
  'jats': {
      'name': 'jats',
      'mime_type': 'application/xml',
      'ext': 'jats'
  },
  'jira': {
      'name': 'jira',
      'mime_type': 'text/plain',
      'ext': 'jira'
  },
  'json': {
      'name': 'json',
      'mime_type': 'application/json',
      'ext': 'json'
  },
  'latex': {
      'name': 'latex',
      'mime_type': 'application/x-tex',
      'ext': 'tex'
  },
  'man': {
      'name': 'man',
      'mime_type': 'text/troff',
      'ext': 'groff'
  },
  'markdown': {
      'name': 'markdown',
      'mime_type': 'text/markdown',
      'ext': 'md'
  },
  'markdown_github': {
      'name': 'markdown_github',
      'mime_type': 'text/markdown',
      'ext': 'md'
  },
  'markdown_mmd': {
      'name': 'markdown_mmd',
      'mime_type': 'text/markdown',
      'ext': 'md'
  },
  'markdown_phpextra': {
      'name': 'markdown_phpextra',
      'mime_type': 'text/markdown',
      'ext': 'md'
  },
  'markdown_strict': {
      'name': 'markdown_strict',
      'mime_type': 'text/markdown',
      'ext': 'md'
  },
  'markua': {
      'name': 'markua',
      'mime_type': 'text/markdown',
      'ext': 'md'
  },
  'mediawiki': {
      'name': 'mediawiki',
      'mime_type': 'text/plain',
      'ext': 'mediawiki'
  },
  'muse': {
      'name': 'muse',
      'mime_type': 'text/plain',
      'ext': 'muse'
  },
  'odt': {
      'name': 'odt',
      'mime_type': 'application/vnd.oasis.opendocument.text',
      'ext': 'odt'
  },
  'opml': {
      'name': 'opml',
      'mime_type': 'text/x-opml',
      'ext': 'opml'
  },
  'pdf': {
      'name': 'pdf',
      'mime_type': 'application/pdf',
      'ext': 'pdf'
  },
  'plain': {
      'name': 'plain',
      'mime_type': 'text/plain',
      'ext': 'txt'
  },
  'pptx': {
      'name': 'pptx',
      'mime_type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'ext': 'pptx'
  },
  'rst': {
      'name': 'rst',
      'mime_type': 'text/x-rst',
      'ext': 'rst'
  },
  'rtf': {
      'name': 'rtf',
      'mime_type': 'application/rtf',
      'ext': 'rtf'
  },
  'texinfo': {
      'name': 'texinfo',
      'mime_type': 'application/x-texinfo',
      'ext': 'texinfo'
  },
  'textile': {
      'name': 'textile',
      'mime_type': 'text/x-textile',
      'ext': 'textile'
  },
  'xwiki': {
      'name': 'xwiki',
      'mime_type': 'text/plain',
      'ext': 'xwiki'
  },
  'zimwiki': {
      'name': 'zimwiki',
      'mime_type': 'text/plain',
      'ext': 'zimwiki'
  }
}


def mime_type_to_input_format(mime_type: str) -> str:
    """
    Converts the given MIME type to its Pandoc input format equivalent.
    :param mime_type: The MIME type to translate into a Pandoc input format.
    :return: The Pandoc input format equivalent.
    :raises ValueError: If the given MIME type is not supported.
    """
    if mime_type not in mime_type_to_pandoc_input_format:
        raise ValueError(f"Unsupported MIME type: {mime_type}")
    return mime_type_to_pandoc_input_format[mime_type]


def input_format_to_output_formats(input: str) -> List[dict]:
    """
    :param input: a Pandoc input type.
    :return: a list of Pandoc output formats to which the input
    document should be converted.
    """
    source = CONVERSION_MAPPING.get(input)
    if not source or 'to' not in source:
        return [{ 'name': 'plain', 'mime_type': 'text/plain', 'ext': 'txt' }]
    return list(map(lambda x: pandoc_output_format_to_mime_type[x], source['to']))


def get_options_for_input(input: str) -> dict:
    """
    :param input: the input format.
    :param output: the output format.
    :return: the options to pass to the Pandoc converter.
    """
    values = CONVERSION_MAPPING.get(input)
    if not values or 'options' not in values:
        return []
    return values['options']
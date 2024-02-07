from urllib.parse import urlparse
from newspaper import Article

def is_absolute(url):
  """
  :param url: The URL to check.
  :return:    True if the URL is absolute, False otherwise.
  """
  return bool(urlparse(url).netloc)


def get_metadata(article: Article) -> dict:
  """
  :param article: The article to extract the metadata from.
  :return:        A dictionary of metadata extracted from the article.
  """
  metadata = {
    'properties': {
      'kind': 'text',
      'attrs': {}
    }
  }
  
  # Authors.
  if bool(article.authors):
    metadata['authors'] = article.authors
  
  # Keywords.
  if bool(article.keywords):
    metadata['keywords'] = article.keywords
  
  # Description within the HTML document.
  if bool(article.meta_description):
    metadata['description'] = article.meta_description
  
  # Description from the summary.
  if not metadata.get('description') and bool(article.summary):
    metadata['description'] = article.summary
  
  # Title.
  if bool(article.title):
    metadata['title'] = article.title
    
  # Top image URL.
  if bool(article.top_image) and is_absolute(article.top_image):
    metadata['image'] = article.top_image
    
  # Publication date.
  if bool(article.publish_date):
    metadata['createdAt'] = article.publish_date.isoformat()
    
  # Language from the HTML document.
  if bool(article.meta_lang):
    metadata['properties']['attrs']['language'] = article.meta_lang
  
  return metadata

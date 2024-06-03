import datetime

def get_metadata(result: dict) -> dict:
  """
  :param result: The result of the processing.
  :return:        A dictionary of metadata extracted from the article.
  """
  metadata = {
    'properties': {
      'kind': 'text',
      'attrs': {}
    }
  }

  try:
    # Authors.
    if bool(result.get('authors')):
      metadata['authors'] = [result['author']]
    
    # Keywords.
    if bool(result.get('categories')):
      metadata['keywords'] = [result['categories']]

    # Description within the HTML document.
    if bool(result.get('excerpt')):
      metadata['description'] = result['excerpt']
    
    # Title.
    if bool(result.get('title')):
      metadata['title'] = result['title']
      
    # Top image URL.
    if bool(result.get('image')):
      metadata['image'] = result['image']
      
    # Publication date.
    if bool(result.get('date')):
      # Parse the date from a string to iso format.
      metadata['createdAt'] = datetime.datetime.strptime(result['date'], '%Y-%m-%d').isoformat()
      
    # Language from the HTML document.
    if bool(result.get('language')):
      metadata['language'] = result['language']
  
  except Exception as e:
    print(e)
  
  return metadata

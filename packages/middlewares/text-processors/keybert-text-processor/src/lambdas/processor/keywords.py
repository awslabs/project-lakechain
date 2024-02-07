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
from chunking import chunk_text
from typing import List
from keybert import KeyBERT
from sentence_transformers import SentenceTransformer

# Environment variables.
CACHE_DIR = os.environ.get('CACHE_DIR')

def get_keywords(
  text: str,
  top_n: int = 5,
  use_max_sum: bool = True,
  diversity: float = 0.5,
  candidates: int = 20,
  embedding_model: str = 'all-MiniLM-L6-v2'
) -> List[str]:
  """
  Extracts the main keywords from the given text.
  :param text: The text to extract the keywords from.
  :param top_n: The maximum number of keywords to extract.
  :param use_max_sum: Whether to use max sum distance for the selection of keywords/keyphrases.
  :param diversity: The diversity of the results between 0 and 1 if `use_mmr` is set to True.
  :param candidates: The number of candidates to consider if `use_maxsum` is set to True.
  :param embedding_model: The embedding model to use.
  :return: a list of extracted keywords.
  """
  model      = SentenceTransformer(embedding_model, cache_folder=CACHE_DIR)
  kw_model   = KeyBERT(model=model)
  keywords   = []
  paragraphs = chunk_text(text, 2000)
  
  # For each paragraph, extract the top n keywords.
  for paragraph in paragraphs:
    keywords.extend(kw_model.extract_keywords(
      paragraph,
      top_n=top_n,
      use_maxsum=use_max_sum,
      diversity=diversity,
      nr_candidates=candidates
    ))
  
  # Eliminate duplicates and keep the highest score for each keyword.
  result_dict = {}
  for key, value in keywords:
    if key not in result_dict or value > result_dict[key]:
      result_dict[key] = value

  # Sort the keywords by score.
  merged_keywords = sorted(result_dict.items(), key=lambda x: x[1], reverse=True)
  
  # Return the top n keywords.
  return [x[0] for x in merged_keywords[:top_n]]
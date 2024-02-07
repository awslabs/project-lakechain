/*
 * Copyright (C) 2023 Amazon.com, Inc. or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * The different possible voices.
 */
export type BarkVoice = 'v2/en_speaker_0' |
  'v2/en_speaker_1' |
  'v2/en_speaker_2' |
  'v2/en_speaker_3' |
  'v2/en_speaker_4' |
  'v2/en_speaker_5' |
  'v2/en_speaker_6' |
  'v2/en_speaker_7' |
  'v2/en_speaker_8' |
  'v2/en_speaker_9' |
  'v2/zh_speaker_0' |
  'v2/zh_speaker_1' |
  'v2/zh_speaker_2' |
  'v2/zh_speaker_3' |
  'v2/zh_speaker_4' |
  'v2/zh_speaker_5' |
  'v2/zh_speaker_6' |
  'v2/zh_speaker_7' |
  'v2/zh_speaker_8' |
  'v2/zh_speaker_9' |
  'v2/fr_speaker_0' |
  'v2/fr_speaker_1' |
  'v2/fr_speaker_2' |
  'v2/fr_speaker_3' |
  'v2/fr_speaker_4' |
  'v2/fr_speaker_5' |
  'v2/fr_speaker_6' |
  'v2/fr_speaker_7' |
  'v2/fr_speaker_8' |
  'v2/fr_speaker_9' |
  'v2/de_speaker_0' |
  'v2/de_speaker_1' |
  'v2/de_speaker_2' |
  'v2/de_speaker_3' |
  'v2/de_speaker_4' |
  'v2/de_speaker_5' |
  'v2/de_speaker_6' |
  'v2/de_speaker_7' |
  'v2/de_speaker_8' |
  'v2/de_speaker_9' |
  'v2/hi_speaker_0' |
  'v2/hi_speaker_1' |
  'v2/hi_speaker_2' |
  'v2/hi_speaker_3' |
  'v2/hi_speaker_4' |
  'v2/hi_speaker_5' |
  'v2/hi_speaker_6' |
  'v2/hi_speaker_7' |
  'v2/hi_speaker_8' |
  'v2/hi_speaker_9' |
  'v2/it_speaker_0' |
  'v2/it_speaker_1' |
  'v2/it_speaker_2' |
  'v2/it_speaker_3' |
  'v2/it_speaker_4' |
  'v2/it_speaker_5' |
  'v2/it_speaker_6' |
  'v2/it_speaker_7' |
  'v2/it_speaker_8' |
  'v2/it_speaker_9' |
  'v2/ja_speaker_0' |
  'v2/ja_speaker_1' |
  'v2/ja_speaker_2' |
  'v2/ja_speaker_3' |
  'v2/ja_speaker_4' |
  'v2/ja_speaker_5' |
  'v2/ja_speaker_6' |
  'v2/ja_speaker_7' |
  'v2/ja_speaker_8' |
  'v2/ja_speaker_9' |
  'v2/ko_speaker_0' |
  'v2/ko_speaker_1' |
  'v2/ko_speaker_2' |
  'v2/ko_speaker_3' |
  'v2/ko_speaker_4' |
  'v2/ko_speaker_5' |
  'v2/ko_speaker_6' |
  'v2/ko_speaker_7' |
  'v2/ko_speaker_8' |
  'v2/ko_speaker_9' |
  'v2/pl_speaker_0' |
  'v2/pl_speaker_1' |
  'v2/pl_speaker_2' |
  'v2/pl_speaker_3' |
  'v2/pl_speaker_4' |
  'v2/pl_speaker_5' |
  'v2/pl_speaker_6' |
  'v2/pl_speaker_7' |
  'v2/pl_speaker_8' |
  'v2/pl_speaker_9' |
  'v2/pt_speaker_0' |
  'v2/pt_speaker_1' |
  'v2/pt_speaker_2' |
  'v2/pt_speaker_3' |
  'v2/pt_speaker_4' |
  'v2/pt_speaker_5' |
  'v2/pt_speaker_6' |
  'v2/pt_speaker_7' |
  'v2/pt_speaker_8' |
  'v2/pt_speaker_9' |
  'v2/ru_speaker_0' |
  'v2/ru_speaker_1' |
  'v2/ru_speaker_2' |
  'v2/ru_speaker_3' |
  'v2/ru_speaker_4' |
  'v2/ru_speaker_5' |
  'v2/ru_speaker_6' |
  'v2/ru_speaker_7' |
  'v2/ru_speaker_8' |
  'v2/ru_speaker_9' |
  'v2/es_speaker_0' |
  'v2/es_speaker_1' |
  'v2/es_speaker_2' |
  'v2/es_speaker_3' |
  'v2/es_speaker_4' |
  'v2/es_speaker_5' |
  'v2/es_speaker_6' |
  'v2/es_speaker_7' |
  'v2/es_speaker_8' |
  'v2/es_speaker_9' |
  'v2/tr_speaker_0' |
  'v2/tr_speaker_1' |
  'v2/tr_speaker_2' |
  'v2/tr_speaker_3' |
  'v2/tr_speaker_4' |
  'v2/tr_speaker_5' |
  'v2/tr_speaker_6' |
  'v2/tr_speaker_7' |
  'v2/tr_speaker_8' |
  'v2/tr_speaker_9';
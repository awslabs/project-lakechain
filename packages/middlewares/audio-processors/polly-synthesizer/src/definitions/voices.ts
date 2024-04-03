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
 * Describes the attributes associated with a voice
 * supported by Amazon Polly.
 */
export interface VoiceMap {
  Gender: string;
  Id: string;
  LanguageCode: string;
  'ISO-639-1': string;
  LanguageName: string;
  Name: string;
  SupportedEngines: string[];
}

export const map: VoiceMap[] = [
  {
    "Gender": "Female",
    "Id": "Isabelle",
    "LanguageCode": "fr-BE",
    "ISO-639-1": "fr",
    "LanguageName": "Belgian French",
    "Name": "Isabelle",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Kevin",
    "LanguageCode": "en-US",
    "ISO-639-1": "en",
    "LanguageName": "US English",
    "Name": "Kevin",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Filiz",
    "LanguageCode": "tr-TR",
    "ISO-639-1": "tr",
    "LanguageName": "Turkish",
    "Name": "Filiz",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Elin",
    "LanguageCode": "sv-SE",
    "ISO-639-1": "sv",
    "LanguageName": "Swedish",
    "Name": "Elin",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Astrid",
    "LanguageCode": "sv-SE",
    "ISO-639-1": "sv",
    "LanguageName": "Swedish",
    "Name": "Astrid",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Tatyana",
    "LanguageCode": "ru-RU",
    "ISO-639-1": "ru",
    "LanguageName": "Russian",
    "Name": "Tatyana",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Maxim",
    "LanguageCode": "ru-RU",
    "ISO-639-1": "ru",
    "LanguageName": "Russian",
    "Name": "Maxim",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Carmen",
    "LanguageCode": "ro-RO",
    "ISO-639-1": "ro",
    "LanguageName": "Romanian",
    "Name": "Carmen",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Ines",
    "LanguageCode": "pt-PT",
    "ISO-639-1": "pt",
    "LanguageName": "Portuguese",
    "Name": "Inês",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Cristiano",
    "LanguageCode": "pt-PT",
    "ISO-639-1": "pt",
    "LanguageName": "Portuguese",
    "Name": "Cristiano",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Vitoria",
    "LanguageCode": "pt-BR",
    "ISO-639-1": "pt",
    "LanguageName": "Brazilian Portuguese",
    "Name": "Vitória",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Ricardo",
    "LanguageCode": "pt-BR",
    "ISO-639-1": "pt",
    "LanguageName": "Brazilian Portuguese",
    "Name": "Ricardo",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Camila",
    "LanguageCode": "pt-BR",
    "ISO-639-1": "pt",
    "LanguageName": "Brazilian Portuguese",
    "Name": "Camila",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Maja",
    "LanguageCode": "pl-PL",
    "ISO-639-1": "pl",
    "LanguageName": "Polish",
    "Name": "Maja",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Jan",
    "LanguageCode": "pl-PL",
    "ISO-639-1": "pl",
    "LanguageName": "Polish",
    "Name": "Jan",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Jacek",
    "LanguageCode": "pl-PL",
    "ISO-639-1": "pl",
    "LanguageName": "Polish",
    "Name": "Jacek",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Ewa",
    "LanguageCode": "pl-PL",
    "ISO-639-1": "pl",
    "LanguageName": "Polish",
    "Name": "Ewa",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Ola",
    "LanguageCode": "pl-PL",
    "ISO-639-1": "pl",
    "LanguageName": "Polish",
    "Name": "Ola",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Lisa",
    "LanguageCode": "nl-BE",
    "ISO-639-1": "nl",
    "LanguageName": "Belgian Dutch",
    "Name": "Lisa",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Ruben",
    "LanguageCode": "nl-NL",
    "ISO-639-1": "nl",
    "LanguageName": "Dutch",
    "Name": "Ruben",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Lotte",
    "LanguageCode": "nl-NL",
    "ISO-639-1": "nl",
    "LanguageName": "Dutch",
    "Name": "Lotte",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Laura",
    "LanguageCode": "nl-NL",
    "ISO-639-1": "nl",
    "LanguageName": "Dutch",
    "Name": "Laura",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Ida",
    "LanguageCode": "nb-NO",
    "ISO-639-1": "nb",
    "LanguageName": "Norwegian",
    "Name": "Ida",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Liv",
    "LanguageCode": "nb-NO",
    "ISO-639-1": "nb",
    "LanguageName": "Norwegian",
    "Name": "Liv",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Seoyeon",
    "LanguageCode": "ko-KR",
    "ISO-639-1": "ko",
    "LanguageName": "Korean",
    "Name": "Seoyeon",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Kazuha",
    "LanguageCode": "ja-JP",
    "ISO-639-1": "ja",
    "LanguageName": "Japanese",
    "Name": "Kazuha",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Tomoko",
    "LanguageCode": "ja-JP",
    "ISO-639-1": "ja",
    "LanguageName": "Japanese",
    "Name": "Tomoko",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Takumi",
    "LanguageCode": "ja-JP",
    "ISO-639-1": "ja",
    "LanguageName": "Japanese",
    "Name": "Takumi",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Mizuki",
    "LanguageCode": "ja-JP",
    "ISO-639-1": "ja",
    "LanguageName": "Japanese",
    "Name": "Mizuki",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Bianca",
    "LanguageCode": "it-IT",
    "ISO-639-1": "it",
    "LanguageName": "Italian",
    "Name": "Bianca",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Giorgio",
    "LanguageCode": "it-IT",
    "ISO-639-1": "it",
    "LanguageName": "Italian",
    "Name": "Giorgio",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Carla",
    "LanguageCode": "it-IT",
    "ISO-639-1": "it",
    "LanguageName": "Italian",
    "Name": "Carla",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Karl",
    "LanguageCode": "is-IS",
    "ISO-639-1": "is",
    "LanguageName": "Icelandic",
    "Name": "Karl",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Dora",
    "LanguageCode": "is-IS",
    "ISO-639-1": "is",
    "LanguageName": "Icelandic",
    "Name": "Dóra",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Mathieu",
    "LanguageCode": "fr-FR",
    "ISO-639-1": "fr",
    "LanguageName": "French",
    "Name": "Mathieu",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Lea",
    "LanguageCode": "fr-FR",
    "ISO-639-1": "fr",
    "LanguageName": "French",
    "Name": "Léa",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Celine",
    "LanguageCode": "fr-FR",
    "ISO-639-1": "fr",
    "LanguageName": "French",
    "Name": "Céline",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Chantal",
    "LanguageCode": "fr-CA",
    "ISO-639-1": "fr",
    "LanguageName": "Canadian French",
    "Name": "Chantal",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Gabrielle",
    "LanguageCode": "fr-CA",
    "ISO-639-1": "fr",
    "LanguageName": "Canadian French",
    "Name": "Gabrielle",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Penelope",
    "LanguageCode": "es-US",
    "ISO-639-1": "es",
    "LanguageName": "US Spanish",
    "Name": "Penélope",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Miguel",
    "LanguageCode": "es-US",
    "ISO-639-1": "es",
    "LanguageName": "US Spanish",
    "Name": "Miguel",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Lupe",
    "LanguageCode": "es-US",
    "ISO-639-1": "es",
    "LanguageName": "US Spanish",
    "Name": "Lupe",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Mia",
    "LanguageCode": "es-MX",
    "ISO-639-1": "es",
    "LanguageName": "Mexican Spanish",
    "Name": "Mia",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Lucia",
    "LanguageCode": "es-ES",
    "ISO-639-1": "es",
    "LanguageName": "Castilian Spanish",
    "Name": "Lucia",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Enrique",
    "LanguageCode": "es-ES",
    "ISO-639-1": "es",
    "LanguageName": "Castilian Spanish",
    "Name": "Enrique",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Conchita",
    "LanguageCode": "es-ES",
    "ISO-639-1": "es",
    "LanguageName": "Castilian Spanish",
    "Name": "Conchita",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Geraint",
    "LanguageCode": "en-GB-WLS",
    "ISO-639-1": "en",
    "LanguageName": "Welsh English",
    "Name": "Geraint",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Salli",
    "LanguageCode": "en-US",
    "ISO-639-1": "en",
    "LanguageName": "US English",
    "Name": "Salli",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Matthew",
    "LanguageCode": "en-US",
    "ISO-639-1": "en",
    "LanguageName": "US English",
    "Name": "Matthew",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Kimberly",
    "LanguageCode": "en-US",
    "ISO-639-1": "en",
    "LanguageName": "US English",
    "Name": "Kimberly",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Kendra",
    "LanguageCode": "en-US",
    "ISO-639-1": "en",
    "LanguageName": "US English",
    "Name": "Kendra",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Justin",
    "LanguageCode": "en-US",
    "ISO-639-1": "en",
    "LanguageName": "US English",
    "Name": "Justin",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Joey",
    "LanguageCode": "en-US",
    "ISO-639-1": "en",
    "LanguageName": "US English",
    "Name": "Joey",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Joanna",
    "LanguageCode": "en-US",
    "ISO-639-1": "en",
    "LanguageName": "US English",
    "Name": "Joanna",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Ivy",
    "LanguageCode": "en-US",
    "ISO-639-1": "en",
    "LanguageName": "US English",
    "Name": "Ivy",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Aria",
    "LanguageCode": "en-NZ",
    "ISO-639-1": "en",
    "LanguageName": "New Zealand English",
    "Name": "Aria",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Ayanda",
    "LanguageCode": "en-ZA",
    "ISO-639-1": "en",
    "LanguageName": "South African English",
    "Name": "Ayanda",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Raveena",
    "LanguageCode": "en-IN",
    "ISO-639-1": "en",
    "LanguageName": "Indian English",
    "Name": "Raveena",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Aditi",
    "LanguageCode": "en-IN",
    "ISO-639-1": "en",
    "LanguageName": "Indian English",
    "Name": "Aditi",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Emma",
    "LanguageCode": "en-GB",
    "ISO-639-1": "en",
    "LanguageName": "British English",
    "Name": "Emma",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Brian",
    "LanguageCode": "en-GB",
    "ISO-639-1": "en",
    "LanguageName": "British English",
    "Name": "Brian",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Amy",
    "LanguageCode": "en-GB",
    "ISO-639-1": "en",
    "LanguageName": "British English",
    "Name": "Amy",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Russell",
    "LanguageCode": "en-AU",
    "ISO-639-1": "en",
    "LanguageName": "Australian English",
    "Name": "Russell",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Nicole",
    "LanguageCode": "en-AU",
    "ISO-639-1": "en",
    "LanguageName": "Australian English",
    "Name": "Nicole",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Olivia",
    "LanguageCode": "en-AU",
    "ISO-639-1": "en",
    "LanguageName": "Australian English",
    "Name": "Olivia",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Vicki",
    "LanguageCode": "de-DE",
    "ISO-639-1": "de",
    "LanguageName": "German",
    "Name": "Vicki",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Marlene",
    "LanguageCode": "de-DE",
    "ISO-639-1": "de",
    "LanguageName": "German",
    "Name": "Marlene",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Hans",
    "LanguageCode": "de-DE",
    "ISO-639-1": "de",
    "LanguageName": "German",
    "Name": "Hans",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Naja",
    "LanguageCode": "da-DK",
    "ISO-639-1": "da",
    "LanguageName": "Danish",
    "Name": "Naja",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Mads",
    "LanguageCode": "da-DK",
    "ISO-639-1": "da",
    "LanguageName": "Danish",
    "Name": "Mads",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Sofie",
    "LanguageCode": "da-DK",
    "ISO-639-1": "da",
    "LanguageName": "Danish",
    "Name": "Sofie",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Gwyneth",
    "LanguageCode": "cy-GB",
    "ISO-639-1": "cy",
    "LanguageName": "Welsh",
    "Name": "Gwyneth",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Zhiyu",
    "LanguageCode": "cmn-CN",
    "ISO-639-1": "zh",
    "LanguageName": "Chinese Mandarin",
    "Name": "Zhiyu",
    "SupportedEngines": [
      "neural",
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Zeina",
    "LanguageCode": "arb",
    "ISO-639-1": "ar",
    "LanguageName": "Arabic",
    "Name": "Zeina",
    "SupportedEngines": [
      "standard"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Hala",
    "LanguageCode": "ar-AE",
    "ISO-639-1": "ar",
    "LanguageName": "Gulf Arabic",
    "Name": "Hala",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Arlet",
    "LanguageCode": "ca-ES",
    "ISO-639-1": "ca",
    "LanguageName": "Catalan",
    "Name": "Arlet",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Hannah",
    "LanguageCode": "de-AT",
    "ISO-639-1": "de",
    "LanguageName": "German",
    "Name": "Hannah",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Ruth",
    "LanguageCode": "en-US",
    "ISO-639-1": "en",
    "LanguageName": "US English",
    "Name": "Ruth",
    "SupportedEngines": [
      "neural",
      "long-form"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Stephen",
    "LanguageCode": "en-US",
    "ISO-639-1": "en",
    "LanguageName": "US English",
    "Name": "Stephen",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Kajal",
    "LanguageCode": "en-IN",
    "ISO-639-1": "en",
    "LanguageName": "Indian English",
    "Name": "Kajal",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Hiujin",
    "LanguageCode": "yue-CN",
    "ISO-639-1": "yue",
    "LanguageName": "Cantonese",
    "Name": "Hiujin",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Suvi",
    "LanguageCode": "fi-FI",
    "ISO-639-1": "fi",
    "LanguageName": "Finnish",
    "Name": "Suvi",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Niamh",
    "LanguageCode": "en-IE",
    "ISO-639-1": "en",
    "LanguageName": "Irish English",
    "Name": "Niamh",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Arthur",
    "LanguageCode": "en-GB",
    "ISO-639-1": "en",
    "LanguageName": "British English",
    "Name": "Arthur",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Daniel",
    "LanguageCode": "de-DE",
    "ISO-639-1": "de",
    "LanguageName": "German",
    "Name": "Daniel",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Danielle",
    "LanguageCode": "en-US",
    "ISO-639-1": "en",
    "LanguageName": "US English",
    "Name": "Danielle",
    "SupportedEngines": [
      "neural",
      "long-form"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Gregory",
    "LanguageCode": "en-US",
    "ISO-639-1": "en",
    "LanguageName": "US English",
    "Name": "Gregory",
    "SupportedEngines": [
      "neural",
      "long-form"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Liam",
    "LanguageCode": "fr-CA",
    "ISO-639-1": "fr",
    "LanguageName": "Canadian French",
    "Name": "Liam",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Pedro",
    "LanguageCode": "es-US",
    "ISO-639-1": "es",
    "LanguageName": "US Spanish",
    "Name": "Pedro",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Sergio",
    "LanguageCode": "es-ES",
    "ISO-639-1": "es",
    "LanguageName": "Castilian Spanish",
    "Name": "Sergio",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Andres",
    "LanguageCode": "es-MX",
    "ISO-639-1": "es",
    "LanguageName": "Mexican Spanish",
    "Name": "Andrés",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Remi",
    "LanguageCode": "fr-FR",
    "ISO-639-1": "fr",
    "LanguageName": "French",
    "Name": "Rémi",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Adriano",
    "LanguageCode": "it-IT",
    "ISO-639-1": "it",
    "LanguageName": "Italian",
    "Name": "Adriano",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Thiago",
    "LanguageCode": "pt-BR",
    "ISO-639-1": "pt",
    "LanguageName": "Brazilian Portuguese",
    "Name": "Thiago",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Male",
    "Id": "Zayd",
    "LanguageCode": "ar-AE",
    "ISO-639-1": "ar",
    "LanguageName": "Gulf Arabic",
    "Name": "Zayd",
    "SupportedEngines": [
      "neural"
    ]
  },
  {
    "Gender": "Female",
    "Id": "Burcu",
    "LanguageCode": "tr-TR",
    "ISO-639-1": "tr",
    "LanguageName": "Turkish",
    "Name": "Burcu",
    "SupportedEngines": [
      "neural"
    ]
  }
];

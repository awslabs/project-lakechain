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
 * Type definition for an Amazon Translate translation detail
 * result.
 */
export interface TranslationDetail {
  sourceFile: string;
  targetFile: string;
  sourceLanguage: string;
  auxiliaryData: any;
}

/**
 * Type definition for the Amazon Translate translation detail
 * metadata file schema.
 */
export interface TranslationDetails {
  sourceLanguageCode: string;
  targetLanguageCode: string;
  charactersTranslated: string;
  documentCountWithCustomerError: string;
  documentCountWithServerError: string;
  inputDataPrefix: string;
  outputDataPrefix: string;
  details: TranslationDetail[];
}
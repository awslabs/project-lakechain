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

import { z } from 'zod';

/**
 * Describes the encoding of the text document.
 * @note the below encodings are the one supported
 * by https://www.npmjs.com/package/iconv-lite.
 */
export const EncodingSchema = z.enum([
  'utf-7',
  'utf-7-imap',
  'utf-8',
  'utf-16',
  'utf16-le',
  'utf16-be',
  'utf32',
  'utf32-le',
  'utf32-be',
  'iso-8859-1',
  'iso-8859-2',
  'iso-8859-3',
  'iso-8859-4',
  'iso-8859-5',
  'iso-8859-6',
  'iso-8859-7',
  'iso-8859-8',
  'iso-8859-9',
  'iso-8859-10',
  'iso-8859-11',
  'iso-8859-12',
  'iso-8859-13',
  'iso-8859-14',
  'iso-8859-15',
  'iso-8859-16',
  'ascii',
  'hex',
  'base64'
]);

export type Encoding = z.infer<typeof EncodingSchema>;

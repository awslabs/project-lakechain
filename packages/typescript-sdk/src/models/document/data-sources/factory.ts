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

import { DataSource } from './data-source.js';
import { S3DataSource } from './s3/index.js';
import { HttpsDataSource } from './https/index.js';

/**
 * A factory function used to create a data source
 * implementation given a URL.
 * @param url the URL pointing to the data source.
 * This can be either a string or a URL object.
 * @returns a data source implementation.
 * @throws an error if no data source implementations
 * support the given URL.
 */
export const createDataSource = (url: URL | string): DataSource => {
  if (typeof url === 'string') {
    url = new URL(url);
  }

  switch (url.protocol) {
    case 's3:':
      return (new S3DataSource(url));
    case 'https:':
      return (new HttpsDataSource(url));
    default:
      throw new Error(`Unsupported data source protocol: ${url.protocol}`);
  }
};
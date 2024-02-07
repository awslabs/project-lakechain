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

import mimeTypes from './mime-types.json';
import { createHash } from 'crypto';
import { Document, createDataSource } from '@project-lakechain/sdk/models';

/**
 * The default mime type to use in case a more precise
 * mime type cannot be resolved.
 */
const DEFAULT_MIME_TYPE = 'application/octet-stream';

/**
 * The default user agent to use when fetching documents.
 */
const USER_AGENT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36';

/**
 * Attempts to resolve the mime type associated with
 * the given HTTP response.
 * @param uri the uri to fetch.
 * @returns the resolved mime type, or undefined if it could
 * not be determined.
 */
export const mimeTypeFromRequest = async (uri: string): Promise<string | undefined> => {
  const res = await fetch(uri, {
    headers: {
      'User-Agent': USER_AGENT
    }
  });
  return (res.headers.get('content-type')?.split(';')[0].trim());
};

/**
 * Compute the file type given the file content.
 * @param bucket the bucket information.
 * @param obj the object information.
 * @return the file type.
 */
export const mimeTypeFromBuffer = async (uri: string): Promise<string | undefined> => {
  try {
    const fileTypeFromStream = (await import('file-type')).fileTypeFromStream;
    const dataSource = createDataSource(uri);
    const type = await fileTypeFromStream(
      await dataSource.asReadStream()
    );
    return (type?.mime);
  } catch (err) {
    // We could not infer the file type from its content.
    return (undefined);
  }
};

/**
 * Compute the file type given a file name.
 * @param filename the file name.
 * @return the file type.
 */
export const mimeTypeFromExtension = (filename: string): string | undefined => {
  const types = mimeTypes as { [key: string]: string };
  const extension = filename.split('.').pop();
  return (types[`.${extension}`]);
};

/**
 * @param uri the document URI.
 * @returns a new document instance associated
 * with the document pointed by the given URI.
 */
export const getDocument = async (uri: string, mimeType?: string): Promise<Document> => {    
  // Create the document builder.
  const builder = new Document.Builder()
    .withUrl(uri);

  if (!mimeType) {
    // We first try to compute the mime type from the pathname
    // of the URL.
    mimeType = mimeTypeFromExtension(new URL(uri).pathname);

    // If the mime type could not be computed, we fallback
    // to determining the file type from the HTTP response.
    if (!mimeType && uri.startsWith('https://')) {
      mimeType = await mimeTypeFromRequest(uri);
    }

    // If the mime type could not be computed, we fallback
    // to determining the file type from its content.
    if (!mimeType) {
      mimeType = await mimeTypeFromBuffer(uri);
    }
  }

  return (builder
    .withType(mimeType || DEFAULT_MIME_TYPE)
    .withEtag(createHash('sha256').update(uri).digest("hex"))
    .build());
};
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

import fs from 'fs';
import path from 'path';
import xray from 'aws-xray-sdk';

import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Document } from '@project-lakechain/sdk/models';

/**
 * Environment variables.
 */
const TARGET_BUCKET = process.env.PROCESSED_FILES_BUCKET;

/**
 * A map of extensions to mime types.
 */
const mimeTypes = JSON.parse(fs.readFileSync('./mime-types.json'));

/**
 * The S3 client.
 */
const s3 = xray.captureAWSv3Client(new S3Client({
  region: process.env.AWS_REGION,
  maxAttempts: 3
}));

/**
 * The default mime type to use in case a more precise
 * mime type cannot be resolved.
 */
const DEFAULT_MIME_TYPE = 'application/octet-stream';

/**
 * @param bucket the name of the S3 bucket.
 * @param key the key of the S3 object.
 * @returns a URL associated with the given S3 bucket
 * and S3 object.
 */
const createUrl = (bucket, key) => {
  return (new S3DocumentDescriptor({
    bucket,
    key
  }).asUri());
};

/**
 * Compute the file type given the file content.
 * @param bucket the bucket information.
 * @param obj the object information.
 * @return the file type, or undefined if the file type
 * could not be determined.
 */
export const mimeTypeFromBuffer = async (file) => {
  try {
    const fileTypeFromStream = (await import('file-type')).fileTypeFromStream;
    const stream = fs.createReadStream(file);
    const type = await fileTypeFromStream(stream);
    return (type?.mime);
  } catch (err) {
    // We could not infer the file type from its content.
    return (undefined);
  }
};

/**
 * Compute the file type given a file name.
 * @param file the file name.
 * @return the file type, or undefined if the file type
 * could not be determined.
 */
export const mimeTypeFromExtension = (file) => {
  const extension = file.split('.').pop();
  return (mimeTypes[`.${extension}`]);
};

/**
 * Creates a new document instance for the given file.
 * @param file the path of the file to associate
 * with a new document.
 * @returns a new document instance with the
 * object information.
 */
export const createDocument = async (file, { chainId }) => {
  const key = path.join(chainId, path.basename(file));

  // We first try to compute the mime type from the object
  // using its extension.
  let mimeType = mimeTypeFromExtension(file);

  // If the mime type could not be computed, we fallback
  // to determining the file type from its content.
  if (!mimeType) {
    mimeType = await mimeTypeFromBuffer(file);
  }

  // If the mime type could not be computed, we fallback
  // to the default mime type.
  mimeType ??= DEFAULT_MIME_TYPE;

  // Create a new document for the given file and upload
  // it to S3.
  return (Document.create({
    url: createUrl(TARGET_BUCKET, key),
    type: mimeType,
    data: fs.createReadStream(file)
  }));
};

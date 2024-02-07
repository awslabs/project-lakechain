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

import { Readable } from 'stream';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { S3Bucket, S3Object } from './definitions/s3';
import { Document, EventType } from '@project-lakechain/sdk/models';
import { tracer } from '@project-lakechain/sdk/powertools';

import {
  S3Client,
  GetObjectCommand,
  NotFound,
  NoSuchKey,
} from '@aws-sdk/client-s3';
import {
  ObjectNotFoundException,
  InvalidDocumentObjectException
} from './exceptions/index.js';

/**
 * The S3 client.
 */
const client = tracer.captureAWSv3Client(new S3Client({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * The default mime types to use in case a more precise
 * mime type cannot be resolved.
 */
const DEFAULT_MIME_TYPES = [
  'application/octet-stream',
  'binary/octet-stream'
];

/**
 * @param objectName the name of the S3 object.
 * @param mimeType the mime type of the object.
 * @returns whether the object name or the mime type
 * is associated with an S3 directory.
 */
export const isDirectory = (objectName: string, mimeType: string | undefined): boolean => {
  if (objectName.endsWith('/')) {
    return (true);
  }
  return (mimeType?.includes('application/x-directory') ?? false);
};

/**
 * @param bucket the bucket associated with the S3 object.
 * @param obj the object information.
 * @returns a URL associated with the given S3 bucket
 * and S3 object.
 */
const createUrl = (bucket: S3Bucket, obj: S3Object): URL => {
  return (new S3DocumentDescriptor({
    bucket: bucket.name,
    key: obj.key
  }).asUri());
};

/**
 * Compute the file type given the file content.
 * @param bucket the bucket information.
 * @param obj the object information.
 * @return the file type.
 */
export const mimeTypeFromBuffer = async (bucket: S3Bucket, obj: S3Object): Promise<string | undefined> => {
  try {
    const fileTypeFromStream = (await import('file-type')).fileTypeFromStream;
    const res = await client.send(new GetObjectCommand({
      Bucket: bucket.name,
      Key: obj.key
    }));

    // If S3 returned a satisfactory mime type, we use it.
    if (res.ContentType && !DEFAULT_MIME_TYPES.includes(res.ContentType)) {
      return (res.ContentType);
    }

    // If not, we try to read from the stream to determine
    // what the mime type is.
    if (res.Body) {
      const type = await fileTypeFromStream(res.Body as Readable);
      return (type?.mime);
    }
    return (undefined);
  } catch (err) {
    if (err instanceof NoSuchKey || err instanceof NotFound) {
      // The S3 object no longer exists.
      throw new ObjectNotFoundException(obj.key);
    }
    // We could not infer the file type from its content.
    return (undefined);
  }
};

/**
 * Compute the file type given a file name.
 * @param file the file name.
 * @return the file type.
 */
export const mimeTypeFromExtension = (file: string): string | undefined => {
  const types = mimeTypes as { [key: string]: string };
  const extension = file.split('.').pop();
  return (types[`.${extension}`]);
};

/**
 * Handles created S3 object creation events.
 * @param bucket the bucket information.
 * @param obj the object information.
 * @returns a new document instance with the
 * object information.
 */
const onCreated = async (bucket: S3Bucket, obj: S3Object): Promise<Document> => {
  let mimeType: string | undefined;
  const url = createUrl(bucket, obj);

  // Create the document builder.
  const builder = new Document.Builder()
    .withUrl(url)
    .withEtag(obj.eTag)
    .withSize(obj.size);

  // We first try to compute the mime type from the object
  // using its extension.
  mimeType = mimeTypeFromExtension(obj.key);

  // If the mime type could not be computed, we fallback
  // to determining the file type from its content.
  if (!mimeType) {
    mimeType = await mimeTypeFromBuffer(bucket, obj);
  }

  // If the notification is about the creation of an S3
  // directory, we throw an error.
  if (isDirectory(obj.key, mimeType)) {
    throw new InvalidDocumentObjectException(obj.key);
  }

  return (builder
    .withType(mimeType || DEFAULT_MIME_TYPES[0])
    .build());
};

/**
 * Handles created S3 object removal events.
 * @param bucket the bucket information.
 * @param obj the object information.
 * @returns a new document instance with the
 * object information.
 */
const onDeleted = (bucket: S3Bucket, obj: S3Object): Document => {
  // If the event is not an object created event, we
  // fallback to determining the file type from its name,
  // as the S3 object will not be available anymore.
  const mimeType = mimeTypeFromExtension(obj.key) ?? DEFAULT_MIME_TYPES[0];

  // If the notification is about the creation of an S3
  // directory, we throw an error.
  if (isDirectory(obj.key, mimeType)) {
    throw new InvalidDocumentObjectException(obj.key);
  }

  // Return the constructed document.
  return (new Document.Builder()
    .withUrl(createUrl(bucket, obj))
    .withEtag(obj.eTag)
    .withSize(obj.size)
    .withType(mimeType)
    .build());
};

/**
 * @param bucket the bucket information.
 * @param obj the object information.
 * @param eventType whether the event is an object created or removed event.
 * @returns a new document instance with the
 * object information.
 */
export const getDocument = async (
  bucket: S3Bucket,
  obj: S3Object,
  eventType: EventType
): Promise<Document> => {
  switch (eventType) {
    case EventType.DOCUMENT_CREATED:
      return (await onCreated(bucket, obj));
    case EventType.DOCUMENT_DELETED:
      return (onDeleted(bucket, obj));
    default:
      throw new Error(`Invalid event type: ${eventType}`);
  }
};
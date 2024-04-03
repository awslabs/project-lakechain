import merge from 'lodash/merge';

import { CloudEvent, Document } from '@project-lakechain/sdk/models';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { tracer } from '@project-lakechain/sdk/powertools';
import { nextAsync } from '@project-lakechain/sdk/decorators';
import { getSettings } from './settings';

import {
  TranslateClient,
  TranslateDocumentCommand
} from '@aws-sdk/client-translate';

/**
 * Environment variables.
 */
const OUTPUT_LANGUAGES = JSON.parse(process.env.OUTPUT_LANGUAGES ?? '[]') as string[];
const TARGET_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;

/**
 * A list of mime-types that are supported for synchronous processing.
 */
export const SYNC_MIME_TYPES = [
  'text/plain',
  'text/html',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

/**
 * The Translate client.
 */
const translate = tracer.captureAWSv3Client(new TranslateClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * @param bucket the bucket name to encode.
 * @param key the key name to encode.
 * @returns the URI for the specified bucket and key.
 */
const toUri = (bucket: string, key: string): URL => {
  return (new S3DocumentDescriptor({ bucket, key }).asUri());
};

/**
 * Processes the document associated with the given event
 * using the Amazon Translate synchronous API.
 * @param event the event to process.
 * @note the synchronous API is limited to 100kb per document,
 * and 10,000 characters per request.
 */
export const processSync = async (event: CloudEvent) => {
  const document = event.data().document();
  const chainId  = event.data().chainId();

  // Load the document in memory.
  const data = await document.data().asBuffer();

  // Translate the document in the defined output languages.
  for (const language of OUTPUT_LANGUAGES) {
    const outputKey = `sync-results/${chainId}/${language}-${document.filename().basename()}`;

    // Translate the document.
    const res = await translate.send(new TranslateDocumentCommand({
      Document: {
        Content: data,
        ContentType: document.mimeType()
      },
      SourceLanguageCode: 'auto',
      TargetLanguageCode: language,
      Settings: getSettings()
    }));

    // Create a new document with the translated content.
    event.data().props.document = await Document.create({
      url: toUri(TARGET_BUCKET, outputKey),
      type: document.mimeType(),
      data: Buffer.from(res.TranslatedDocument?.Content ?? '')
    });

    // Update the metadata.
    merge(event.data().props.metadata, {
      properties: {
        kind: 'text',
        attrs: {
          language
        }
      }
    });

    // Forward the document to the next middlewares.
    await nextAsync(event);
  }
}
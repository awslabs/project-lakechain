import { CloudEvent } from '@project-lakechain/sdk/models';
import { tracer } from '@project-lakechain/sdk/powertools';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers'
import { S3Client, CopyObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { getSettings } from './settings';

import {
  TranslateClient,
  StartTextTranslationJobCommand
} from '@aws-sdk/client-translate';

/**
 * Environment variables.
 */
const OUTPUT_LANGUAGES = JSON.parse(process.env.OUTPUT_LANGUAGES ?? '[]') as string[];
const TARGET_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;
const TRANSLATE_ROLE_ARN = process.env.TRANSLATE_ROLE_ARN as string;

/**
 * The Translate client.
 */
const translate = tracer.captureAWSv3Client(new TranslateClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * The DynamoDB client.
 */
const dynamodb = tracer.captureAWSv3Client(new DynamoDBClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * The S3 client.
 */
const s3 = tracer.captureAWSv3Client(new S3Client({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * This method computes the time-to-live value for events stored in DynamoDB.
 * The purpose is to ensure that elements within the table are automatically
 * deleted after a certain amount of time.
 * @returns a time-to-live value for events stored in DynamoDB.
 * @default 24 hours.
 */
const getTtl = () => {
  const SECONDS_IN_AN_HOUR = 60 * 60;
  return (Math.round(Date.now() / 1000) + (24 * SECONDS_IN_AN_HOUR));
};

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
 * using the Amazon Translate asynchronous API.
 * @param event the event to process.
 * @returns a promise that resolves when the translation job
 * has been successfully scheduled.
 */
export const processAsync = async (event: CloudEvent) => {
  const document  = event.data().document();
  const jobId     = `${event.data().chainId()}-${document.etag()}`;
  const inputKey  = `inputs/${jobId}`;
  const outputKey = `outputs/${jobId}`;
  const sourceUri = S3DocumentDescriptor.fromUri(document.url());
  const ttl       = getTtl();

  // Copy the source file in a new prefix on S3 as Amazon Translate
  // expects a directory with multiple documents.
  await s3.send(new CopyObjectCommand({
    Bucket: TARGET_BUCKET,
    Key: `${inputKey}/${document.filename().basename()}`,
    CopySource: encodeURIComponent(
      `${sourceUri.bucket()}/${sourceUri.key()}`
    ),
    ContentType: document.mimeType()
  }));

  // Schedule a new translation job.
  await translate.send(new StartTextTranslationJobCommand({
    JobName: jobId,
    DataAccessRoleArn: TRANSLATE_ROLE_ARN,
    InputDataConfig: {
      S3Uri: toUri(TARGET_BUCKET, inputKey).toString(),
      ContentType: document.mimeType()
    },
    OutputDataConfig: {
      S3Uri: toUri(TARGET_BUCKET, outputKey).toString()
    },
    SourceLanguageCode: 'auto',
    TargetLanguageCodes: OUTPUT_LANGUAGES,
    Settings: getSettings()
  }));

  // Create a new entry in DynamoDB.
  return (await dynamodb.send(new PutItemCommand({
    TableName: process.env.MAPPING_TABLE,
    Item: {
      // We compute a translation identifier based on the
      // document etag and the chain identifier. This will uniquely
      // identify the translation for this specific document.
      TranslationJobId: { S: jobId },
      // The document event is serialized in the table as well, to
      // keep an association between the document and the translation.
      event: { S: JSON.stringify(event) },
      // Every entry in the table has a time-to-live value that
      // is used to automatically delete entries after a certain
      // amount of time.
      ttl: { N: ttl.toString() }
    }
  })));
};

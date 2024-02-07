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

import { LambdaInterface } from '@aws-lambda-powertools/commons';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { CloudEvent } from '@project-lakechain/sdk/models';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

import {
  TranslateClient,
  StartTextTranslationJobCommand,
  TranslationSettings,
  Formality
} from '@aws-sdk/client-translate';
import {
  SQSEvent,
  SQSRecord,
  Context,
  SQSBatchResponse
} from 'aws-lambda';
import {
  BatchProcessor,
  EventType,
  processPartialResponse
} from '@aws-lambda-powertools/batch';

// We de-serialize the output languages.
const OUTPUT_LANGUAGES = JSON.parse(process.env.OUTPUT_LANGUAGES ?? '[]') as string[];
const PROFANITY_REDACTION = process.env.PROFANITY_REDACTION === 'true';
const FORMALITY = process.env.FORMALITY ?? 'NONE';
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
 * The async batch processor processes the received
 * events from SQS in parallel.
 */
const processor = new BatchProcessor(EventType.SQS);

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
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * @returns the settings to use for the translation job.
   */
  private getSettings(): TranslationSettings {
    const settings: TranslationSettings = {};

    // If profanity redaction is enabled, we set the profanity
    // setting to MASK.
    if (PROFANITY_REDACTION) {
      settings['Profanity'] = 'MASK';
    }

    // If formality is enabled, we set the formality setting
    // to the value of the FORMALITY environment variable.
    if (FORMALITY !== 'NONE') {
      settings['Formality'] = FORMALITY as Formality;
    }

    return (settings);
  }

  /**
   * @param event the event to process.
   */
  async processEvent(event: CloudEvent): Promise<any> {
    const document  = event.data().document();
    const jobId     = `${event.data().chainId()}-${document.etag()}`;
    const inputKey  = `inputs/${jobId}`;
    const outputKey = `outputs/${jobId}`;
    const ttl       = getTtl();

    // Load the document in memory.
    const data = await document.data().asBuffer();

    // Copy the source file in a new prefix on S3.
    await s3.send(new PutObjectCommand({
      Bucket: process.env.PROCESSED_FILES_BUCKET,
      Key: `${inputKey}/${document.filename().basename()}`,
      Body: data,
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
      Settings: this.getSettings()
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
  }

  /**
   * The Lambda entry point.
   * @param event the received SQS event.
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: SQSEvent, _: Context): Promise<SQSBatchResponse> {
    return (await processPartialResponse(
      event,
      (record: SQSRecord) => this.processEvent(
        CloudEvent.from(JSON.parse(record.body))
      ),
      processor
    ));
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);

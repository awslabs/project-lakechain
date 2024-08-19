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

import pThrottle from 'p-throttle';

import { randomUUID } from 'crypto';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { logger, tracer } from '@project-lakechain/sdk/powertools';
import { getSecret } from '@aws-lambda-powertools/parameters/secrets';
import { CloudEvent, Document } from '@project-lakechain/sdk/models';
import { next } from '@project-lakechain/sdk/decorators';
import { S3DocumentDescriptor } from '@project-lakechain/sdk/helpers';
import { ElevenLabsClient, ElevenLabs } from 'elevenlabs';

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

/**
 * Environment variables.
 */
const TARGET_BUCKET             = process.env.PROCESSED_FILES_BUCKET as string;
const ELEVENLABS_MODEL          = process.env.ELEVENLABS_MODEL as string;
const ELEVENLABS_VOICE          = process.env.ELEVENLABS_VOICE as string;
const ELEVENLABS_API_KEY_NAME   = process.env.ELEVENLABS_API_KEY_SECRET_NAME as string;
const ELEVENLABS_OUTPUT_FORMAT  = process.env.ELEVENLABS_OUTPUT_FORMAT as ElevenLabs.OutputFormat;
const ELEVENLABS_VOICE_SETTINGS = JSON.parse(process.env.ELEVENLABS_VOICE_SETTINGS as string);
const API_KEY_MAX_AGE           = parseInt(process.env.API_KEY_MAX_AGE ?? '180');

/**
 * The async batch processor processes the received
 * events from SQS in parallel.
 */
const processor = new BatchProcessor(EventType.SQS);

/**
 * The throttle function to limit the number of
 * concurrent requests to the ElevenLabs API.
 * @default 1 request every 2 seconds.
 */
const throttle = pThrottle({
	limit: 1,
	interval: 2000
});

/**
 * Synthesize the text using the ElevenLabs API.
 * @param text the text to synthesize.
 * The throttled function to call the ElevenLabs API.
 */
const synthesizeText = throttle(async (text) => {
  const apiKey = await getSecret(ELEVENLABS_API_KEY_NAME, {
    maxAge: API_KEY_MAX_AGE
  }) as string;

  // Create a new ElevenLabs client.
  const client = new ElevenLabsClient({ apiKey });

  // Synthesize the text.
  return (client.textToSpeech.convert(ELEVENLABS_VOICE, {
    text,
    model_id: ELEVENLABS_MODEL,
    voice_settings: Object.keys(ELEVENLABS_VOICE_SETTINGS) ?
      ELEVENLABS_VOICE_SETTINGS :
      undefined,
    output_format: ELEVENLABS_OUTPUT_FORMAT
  }, { maxRetries: 5 }));
});

/**
 * Convert a readable stream to a buffer.
 * @param readable the readable stream to convert.
 */
const streamToBuffer = async (readable: NodeJS.ReadableStream): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(chunk as Buffer);
  }
  return (Buffer.concat(chunks));
}

/**
 * The lambda class definition containing the lambda handler.
 * @note using a `LambdaInterface` is required in
 * this context in order to be able to use annotations
 * that are only supported on classes and methods.
 */
class Lambda implements LambdaInterface {

  /**
   * @returns the output type based on the output format.
   */
  private getOutputType(): { mimeType: string, extension: string } {
    if (ELEVENLABS_OUTPUT_FORMAT.startsWith('mp3')) {
      return ({ mimeType: 'audio/mpeg', extension: 'mp3' });
    } else if (ELEVENLABS_OUTPUT_FORMAT.startsWith('pcm')) {
      return ({ mimeType: 'audio/L16', extension: 'pcm' });
    } else if (ELEVENLABS_OUTPUT_FORMAT.startsWith('ulaw')) {
      return ({ mimeType: 'audio/basic', extension: 'ulaw' });
    } else {
      throw new Error(`Unsupported output format: ${ELEVENLABS_OUTPUT_FORMAT}`);
    }
  };

  /**
   * @param event the event to process.
   * @note the next decorator will automatically forward the
   * returned cloud event to the next middlewares
   */
  @next()
  async processEvent(event: CloudEvent): Promise<CloudEvent> {
    const document = event.data().document();
    const outputType = this.getOutputType();
    const key = `${event.data().chainId()}/${randomUUID()}.${outputType.extension}`;

    // We load the text file in memory.
    const text = (await document.data().asBuffer()).toString('utf-8');

    // Synthesize the text.
    const readable = await synthesizeText(text);

    // Upload the processed document to S3.
    event.data().props.document = await Document.create({
      url: new S3DocumentDescriptor({
        bucket: TARGET_BUCKET,
        key
      }).asUri(),
      data: await streamToBuffer(readable),
      type: outputType.mimeType
    });

    return (event);
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
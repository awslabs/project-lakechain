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
import http from 'http';

import { randomUUID } from 'crypto';
import { nextAsync } from '@project-lakechain/sdk/decorators';
import { pollDocuments } from './message-provider.js';
import { download } from './download.js';
import { createDocument } from './get-document.js';
import { exec } from './ffmpeg/exec.js';

/**
 * Environment variables.
 */
const SERVICE_NAME = process.env.POWERTOOLS_SERVICE_NAME ?? 'ffmpeg-processor';
const INPUT_QUEUE_URL = process.env.INPUT_QUEUE_URL;
const CACHE_DIR = process.env.CACHE_DIR ?? '/tmp';

/**
 * X-Ray.
 */
xray.captureHTTPsGlobal(http);
xray.capturePromise();

/**
 * This function processes the documents created by FFMPEG
 * in the output directory. It will create a new document
 * for each output file, and forward the document to the
 * next middlewares.
 * @param {*} events the input events.
 * @param {*} outputDir the directory in which FFMEG has
 * created the output files.
 */
const makeEvents = async (events, outputDir) => {
  const array = [];
  const files = fs.readdirSync(outputDir);
  
  for (const filename of files) {
    const file  = path.join(outputDir, filename);
    const event = events[0].clone();
    const data  = event.data();

    // Create a new document for the output file.
    data.props.document = await createDocument(file, {
      chainId: data.chainId()
    });
    data.props.metadata = {};
    array.push(event);
  }

  return (array);
};

/**
 * Processes the given document events using the user-provided
 * function. This function will download the documents to the
 * elastic file system, execute the user-provided function, and
 * forward the results to the next middleware.
 * It uses a `partitionId` which is a unique identifier created
 * for this specific execution. Its purpose is to scope the output
 * files created by FFMPEG to a specific directory on the elastic
 * file system.
 * @param {*} events an array of input document events.
 */
const processEvents = async (inputs) => {
  const partitionId = randomUUID();
  const partition   = path.join(CACHE_DIR, partitionId);
  const inputsDir   = path.join(partition, 'inputs');
  const outputsDir  = path.join(partition, 'outputs');

  try {
    // Create partition directories.
    [inputsDir, outputsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    // Download the input documents to the elastic file system.
    await download(inputs, { directory: inputsDir });

    // Execute the FFMPEG processing within the output directory.
    await exec(inputs, { cwd: outputsDir });

    // Process documents produced by FFMPEG.
    const outputs = await makeEvents(inputs, outputsDir);

    // Forward the documents to the next middleware.
    for (const output of outputs) {
      await nextAsync(output);
    }
  } finally {
    // Clean up the partition directory.
    fs.rmSync(partition, { recursive: true });
  }
};

/**
 * Polls documents from the input queue and processes them.
 * This function will continuously poll documents sequentially
 * until no more documents are available.
 */
const handler = async () => {
  const segment = new xray.Segment(SERVICE_NAME);

  while (true) {
    const message = await pollDocuments(INPUT_QUEUE_URL);
    if (!message) {
      // No more documents to process.
      break;
    }
    // Process the documents.
    await processEvents(message.events);
    // Remove the document from the queue.
    await message.delete();
  }
  segment.close();
};

/**
 * Running the handler function.
 */
(async () => handler())();

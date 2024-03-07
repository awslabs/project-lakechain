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

import { randomUUID } from 'crypto';
import { next } from '@project-lakechain/sdk/decorators';
import { pollDocuments } from './message-provider.js';
import { download } from './download.js';
import { getDocument } from './get-document.js';
import { exec } from './ffmpeg/exec.js';

/**
 * Environment variables.
 */
const INPUT_QUEUE_URL = process.env.INPUT_QUEUE_URL;
const CACHE_DIR = process.env.CACHE_DIR ?? '/tmp';

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
  const events = [];
  const files  = fs.readdirSync(outputDir);
  
  for (const filename of files) {
    const file  = path.join(outputDir, filename);
    const event = events[0].clone();
    const data  = event.data();

    // Update the event with the new document.
    data.props.document = await getDocument(file, {
      chainId: data.chainId()
    });
    data.props.metadata = {};
    events.push(event);
  }

  return (events);
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
const processEvents = async (events) => {
  const partitionId = randomUUID();
  const partition   = path.join(CACHE_DIR, partitionId);
  const inputsDir   = path.join(partition, 'inputs');
  const outputsDir  = path.join(partition, 'outputs');

  try {
    // Create partition directories.
    [inputsDir, outputsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        console.log(`Creating directory ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }
    });
        
    // Download the input documents to the elastic file system.
    await download(events, { directory: inputsDir });

    // Execute the FFMPEG processing within the output directory.
    await exec(events, { cwd: outputsDir });

    // Process documents produced by FFMPEG.
    const events = await makeEvents(events, outputsDir);
    console.log(JSON.stringify(events, null, 2));
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
  while (true) {
    try {
      const message = await pollDocuments(INPUT_QUEUE_URL);
      if (message) {
        // Process the documents.
        await processEvents(message.events);
        // Remove the document from the queue.
        await message.delete();
      } else {
        break;
      }
    } catch (err) {
      console.error(err);
    }
  }
};

/**
 * Running the handler function.
 */
(async () => handler())();

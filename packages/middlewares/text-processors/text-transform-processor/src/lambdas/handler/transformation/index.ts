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

import { CloudEvent } from '@project-lakechain/sdk';
import { tracer } from '@project-lakechain/sdk/powertools';
import { replace } from './replace.js';
import { substring } from './substring.js';
import { base64 } from './base64.js';
import { redact } from './redact.js';

interface Operation {
  name: string;
  params: any;
}

/**
 * Handles an intent composed by a sequence of operations
 * to perform using the Amazon Rekognition service.
 */
export class IntentHandler {

  constructor(private ops: Operation[]) {}

  /**
   * Distributes the received operations to run on the
   * text to the different handlers.
   * @param text the text to transform.
   * @returns a new document metadata instance with capture metadata.
   */
  @tracer.captureMethod()
  async transform(event: CloudEvent): Promise<string> {
    const document = event.data().document();
    let text = (await document.data().asBuffer()).toString('utf-8');

    for (const op of this.ops) {
      if (op.name === 'replace') {
        text = replace(text, event, op.params);
      } else if (op.name === 'substring') {
        text = substring(text, op.params);
      } else if (op.name === 'base64') {
        text = base64(text, op.params);
      } else if (op.name === 'redact') {
        text = await redact(text, event, op.params);
      }
    }

    return (text);
  }
}

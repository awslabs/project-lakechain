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

import { tracer } from '@project-lakechain/sdk/powertools';
import { DocumentMetadata } from '@project-lakechain/sdk/models';
import { CacheStorage } from '@project-lakechain/sdk/cache';
import { detectLabels } from './labels/index.js';
import { detectFaces } from './faces/index.js';
import { detectText } from './text/index.js';
import { detectPpe } from './ppe/index.js';

/**
 * Represents a captured operation.
 */
export interface Operation {

  /**
   * The name of the operation.
   */
  op: string;

  /**
   * The arguments associated with the operation.
   */
  args: any[];
}

/**
 * The middleware cache storage.
 */
const cacheStorage = new CacheStorage();

/**
 * Handles an intent composed by a sequence of operations
 * to perform using the Amazon Rekognition service.
 */
export class IntentHandler {

  constructor(private ops: Operation[]) {}

  /**
   * Distributes the received operations to run on the
   * image to the different detection functions.
   * @param url the URL of the image to run detections on.
   * @returns a new document metadata instance with capture metadata.
   */
  @tracer.captureMethod()
  async detect(url: URL): Promise<DocumentMetadata> {
    const metadata: DocumentMetadata = {};

    // Image properties.
    metadata.properties = {
      kind: 'image',
      attrs: {}
    };

    // Statistics associated with the image.
    metadata.properties.attrs.stats = {};

    for (const op of this.ops) {
      if (op.op === 'labels') {
        // Label detection.
        const res = await detectLabels(url, op.args[0]);
        metadata.properties.attrs.labels = await cacheStorage.put('labels', res.labels);
        metadata.properties.attrs.objects = await cacheStorage.put('objects', res.objects);
        metadata.properties.attrs.stats.labels = res.labels.length;
        metadata.properties.attrs.stats.objects = res.objects.length;
        metadata.properties.attrs.stats.moderations = res.moderated.length;
        metadata.keywords = res.labels.slice(0, 5).map(label => label.name());
      } else if (op.op === 'faces') {
        // Face detection.
        const faces = await detectFaces(url, op.args[0]);
        metadata.properties.attrs.faces = await cacheStorage.put('faces', faces);
        metadata.properties.attrs.stats.faces = faces.length;
      } else if (op.op === 'text') {
        // Text detection.
        const text = await detectText(url, op.args[0]);
        metadata.properties.attrs.text = await cacheStorage.put('text', text);
        metadata.properties.attrs.stats.text = text.length;
      } else if (op.op === 'ppe') {
        // Personal protective equipment detection.
        const ppe = await detectPpe(url, op.args[0]);
        metadata.properties.attrs.ppe = ppe;
      }
    }

    return (metadata);
  }
}

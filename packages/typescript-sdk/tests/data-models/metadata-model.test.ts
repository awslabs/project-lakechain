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

import { describe, it } from 'node:test';
import { DocumentMetadataSchema } from '../../src/models/document/metadata/index.js';

describe('Document Metadata Data Model', () => {
  it('should be able to parse a minimal document metadata', () => {
    // Empty metadata.
    DocumentMetadataSchema.parse({});

    // Minimalistic document.
    DocumentMetadataSchema.parse({
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authors: ['test'],
      title: 'test',
      description: 'test',
      keywords: ['test']
    });
  });

  it('should be able to parse metadata for text documents', () => {
    DocumentMetadataSchema.parse({
      properties: {
        kind: 'text',
        attrs: {
          language: 'en',
          pages: 1,
          chapters: 1
        }
      }
    });
  });

  it('should be able to parse metadata for image documents', () => {
    DocumentMetadataSchema.parse({
      properties: {
        kind: 'image',
        attrs: {
          dimensions: {
            width: 1,
            height: 1
          },
          format: 'png',
          dominantColor: {
            red: 1,
            green: 1,
            blue: 1
          }
        }
      }
    });
  });

  it('should be able to parse metadata for audio documents', () => {
    DocumentMetadataSchema.parse({
      properties: {
        kind: 'audio',
        attrs: {
          duration: 1,
          codec: 'mp3',
          bitrate: 1
        }
      }
    });
  });

  it('should be able to parse metadata for video documents', () => {
    DocumentMetadataSchema.parse({
      properties: {
        kind: 'video',
        attrs: {
          resolution: {
            width: 1,
            height: 1
          },
          duration: 1,
          codec: 'mp4'
        }
      }
    });
  });
});

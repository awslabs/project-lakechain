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

import path from 'path';

import { z } from 'zod';
import { v5 } from 'uuid';
import { DataSource } from './data-sources/data-source.js';
import { createDataSource } from './data-sources/factory.js';
import { FileProperties } from './file-properties.js';
import { Readable } from 'stream';

/**
 * The schema for the document object.
 */
export const DocumentSchema = z.object({

  /**
   * A URL pointing to the document.
   */
  url: z
    .preprocess((url: any) => {
      return (url instanceof URL ? url : new URL(url));
    }, z.instanceof(URL))
    .describe('The document location.'),

  /**
   * The MIME type of the document.
   */
  type: z
    .string()
    .describe('The document location.'),

  /**
   * The size of the document in bytes.
   */
  size: z
    .number()
    .describe('The size, in bytes, of the document.')
    .optional(),

  /**
   * A hash representing the document content.
   */
  etag: z
    .string()
    .describe('A content-based hash of the document.')
    .optional()
}).strict();

/**
 * The document properties type.
 */
type DocumentSchemaProps = z.infer<typeof DocumentSchema>;

/**
 * Builder for the document.
 */
class Builder {

  private props: Partial<DocumentSchemaProps> = {};

  /**
   * @param url The URL pointing to the content
   * of the document.
   * @returns The builder instance.
   */
  public withUrl(url: string | URL) {
    this.props.url = typeof url === 'string' ? new URL(url) : url;
    return (this);
  }

  /**
   * @param type The mime type of the document.
   * @returns The builder instance.
   */
  public withType(type: string) {
    this.props.type = type;
    return (this);
  }

  /**
   * @param size The size of the document.
   * @returns The builder instance.
   */
  public withSize(size: number) {
    this.props.size = size;
    return (this);
  }

  /**
   * @param etag The etag of the document.
   * @returns The builder instance.
   */
  public withEtag(etag: string) {
    this.props.etag = etag;
    return (this);
  }

  /**
   * @returns A new document instance.
   */
  public build(): Document {
    return (new Document(DocumentSchema.parse(this.props)));
  }
}

/**
 * Represents a document that can be processed and stored.
 * This class describes the different attributes of a document
 * such that it can be seamlessly processed by the Lake GPT middlewares.
 */
export class Document {

  /**
   * The data source associated with the document.
   */
  private dataSource: DataSource;

  /**
   * The builder class.
   */
  static Builder = Builder;

  /**
   * @param props The document properties.
   */
  constructor(public props: DocumentSchemaProps) {
    Object.defineProperty(this, 'dataSource', {
      value: createDataSource(this.props.url),
      enumerable: false
    });
  }

  /**
   * @param data An object representing the document.
   * This can be a JSON string or an object.
   * @returns A document instance.
   * @throws An error if the document is invalid.
   */
  static from(data: string | object): Document {
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    return (new Document(DocumentSchema.parse(data)));
  }

  /**
   * @returns A unique, opaque, identifier that can be
   * considered unique for identifying the document.
   * @note The underlying implementation can change,
   * it should not be assumed the format of the identifier to
   * remain stable.
   */
  id(): string {
    return (v5(this.url().toString(), v5.URL));
  }

  /**
   * @returns The url associated with the document
   * as a URL object.
   * @throws An error if the url is invalid.
   */
  url(): URL {
    return (this.props.url);
  }

  /**
   * @returns The filename of the document.
   * as a string.
   */
  filename(): FileProperties {
    const props = path.parse(decodeURIComponent(
      this.url().pathname
    ));
    // Example : /path/to/file.txt
    return ({
      // Example : .txt
      extension: () => props.ext,
      // Example : file.txt
      basename: () => props.base,
      // Example : /path/to
      path: () => props.dir,
      // Example : file
      name: () => props.name
    });
  }

  /**
   * @returns The mime type of the document.
   */
  mimeType(): string {
    return (this.props.type);
  }

  /**
   * @returns The size of the document.
   */
  size(): number | undefined {
    return (this.props.size);
  }

  /**
   * @returns The etag of the document.
   */
  etag(): string | undefined {
    return (this.props.etag);
  }

  /**
   * @returns The data source object associated
   * with the document.
   */
  data(): DataSource {
    return (this.dataSource);
  }

  /**
   * @returns A new instance consisting of a deep copy of
   * values associated with the current document.
   */
  clone(): Document {
    const size    = this.size();
    const etag    = this.etag();
    const builder = new Document.Builder()
      .withUrl(new URL(this.url().toString()))
      .withType(this.mimeType())

    if (size) {
      builder.withSize(size);
    }

    if (etag) {
      builder.withEtag(etag);
    }

    return (builder.build());
  }

  /**
   * Creates a new document instance and stores the data associated with
   * the new document in the storage associated with the given URL.
   * @param input an object describing the attributes of the document.
   * @returns a new instance of a document.
   */
  static async create(input: {
    url: URL | string,
    type: string,
    data: Buffer | Readable
  }): Promise<Document> {
    let size         = 0;
    const dataSource = createDataSource(input.url);
    const writable   = dataSource.asWriteStream({ ContentType: input.type });

    // Create a new document instance.
    const document = new Document.Builder()
      .withUrl(input.url)
      .withType(input.type);

    // Track the size of the data being written.
    writable.on('data', (chunk) => size += chunk.length);

    // Write the data to the data source.
    if (input.data instanceof Buffer) {
      writable.end(input.data);
    } else if (input.data instanceof Readable) {
      input.data.pipe(writable);
    }

    return (new Promise((resolve, reject) => {
      // Document upload is complete.
      writable.on('uploaded', (res: any) => {
        if (res.ETag) {
          document.withEtag(res.ETag.replace(/"/g, ''));
        }
        document.withSize(size);
        resolve(document.build());
      });
      
      // Error handler.
      writable.on('error', (err) => {
        console.error('Failed to write data to the data source.');
        reject(err);
      });
    })) as Promise<Document>;
  }

  /**
   * Describes how the document should be serialized.
   * @returns A JSON representation of the document.
   */
  toJSON() {
    return ({
      url: this.url().toString(),
      type: this.mimeType(),
      size: this.size(),
      etag: this.etag()
    });
  }
}

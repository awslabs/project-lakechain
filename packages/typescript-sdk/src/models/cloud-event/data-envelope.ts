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

import { z } from 'zod';
import { Document } from '../document/document.js';
import { DocumentMetadata, DocumentMetadataSchema } from '../document/metadata/index.js';

/**
 * The schema for the data envelope object.
 * The data envelope is used to describe the
 * original document being processed, its current
 * representation, and its metadata.
 */
const DataEnvelopeSchema = z.object({

  /**
   * An identifier identifying a pipeline chain
   * execution.
   */
  chainId: z
    .string()
    .uuid()
    .describe('The instance of a pipeline execution for a given document.'),

  /**
   * The description associated with the
   * original document.
   */
  source: z
    .preprocess((source: any) => {
      return (source instanceof Document ? source : Document.from(source));
    }, z.instanceof(Document))
    .describe('A pointer to the current version of a document being processed in the pipeline.'),

  /**
   * The description associated with the
   * current document representation.
   */
  document: z
    .preprocess((source: any) => {
      return (source instanceof Document ? source : Document.from(source));
    }, z.instanceof(Document))
    .describe('A pointer to the current version of a document being processed in the pipeline.'),

  /**
   * The metadata extracted from the document
   * by the middlewares in the chain.
   */
  metadata: DocumentMetadataSchema
    .describe('An object containing additional metadata about the document.')
    .default({}),

  /**
   * The call stack keeping track of the
   * middlewares invoked along a chain.
   */
  callStack: z
    .array(z.string())
    .describe('An array of middlewares having been executed in a pipeline execution.')
    .default([])
});

/**
 * The data envelope properties type.
 */
type DataEnvelopeProps = z.infer<typeof DataEnvelopeSchema>;

/**
 * Builder for the data envelope.
 */
class Builder {

  private props: Partial<DataEnvelopeProps> = {};

  /**
   * @param chainId the identifier of the chain.
   * @returns the builder instance.
   */
  public withChainId(chainId: string) {
    this.props.chainId = chainId;
    return (this);
  }

  /**
   * @param source the source document
   * associated with the data envelope.
   * @returns the builder instance.
   */
  public withSourceDocument(source: Document) {
    this.props.source = source;
    return (this);
  }

  /**
   * @param document the document associated with
   * the data envelope.
   * @returns the builder instance.
   */
  public withDocument(document: Document) {
    this.props.document = document;
    return (this);
  }

  /**
   * @param metadata the metadata associated with
   * the data envelope.
   * @returns the builder instance.
   */
  public withMetadata(metadata: DocumentMetadata) {
    this.props.metadata = metadata;
    return (this);
  }

  /**
   * @param callStack the call stack associated with
   * the data envelope.
   * @returns the builder instance.
   */
  public withCallStack(callStack: string[]) {
    this.props.callStack = callStack;
    return (this);
  }

  /**
   * @returns a new cloud event instance.
   */
  public build() {
    return (new DataEnvelope(DataEnvelopeSchema.parse(this.props)));
  }
}

/**
 * Represents the data envelope within a cloud event.
 * A data envelope wraps the information associated
 * with the event such as the source and the current
 * document being processed, the pipeline chain execution
 * identifier, and the call stack of middlewares having
 * been invoked.
 */
export class DataEnvelope {

  /**
   * The builder for the data envelope.
   */
  static Builder = Builder;

  /**
   * @param chainId the identifier of the chain.
   * @param source the document representing
   * the data provider source.
   * @param document the current document being processed.
   * @param metadata the metadata associated with the
   * source document.
   */
  constructor(public props: DataEnvelopeProps) {}

  /**
   * @param data an object representing the data
   * envelope. This can be a JSON string or an object.
   * @returns a data envelope instance.
   * @throws an error if the data envelope is invalid.
   */
  static from(data: string | object): DataEnvelope {
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    return (new DataEnvelope(DataEnvelopeSchema.parse(data)));
  }

  /**
   * @returns the unique identifier of the pipeline
   * chain execution.
   */
  chainId(): string {
    return (this.props.chainId);
  }

  /**
   * @returns the source document associated with
   * the data envelope.
   */
  source(): Document {
    return (this.props.source);
  }

  /**
   * @returns the current document to be processed.
   */
  document(): Document {
    return (this.props.document);
  }

  /**
   * @returns the metadata associated with the
   * source document.
   */
  metadata(): DocumentMetadata {
    return (this.props.metadata);
  }

  /**
   * @returns the call stack associated with the
   * chain execution.
   */
  callStack(): string[] {
    return (this.props.callStack);
  }

  /**
   * @returns a new instance of the current data envelope
   * consisting of a deep copy of values associated with it.
   */
  clone(): DataEnvelope {
    return (new DataEnvelope.Builder()
      .withChainId(this.chainId())
      .withMetadata(this.metadata())
      .withSourceDocument(this.source().clone())
      .withDocument(this.document().clone())
      .withCallStack(this.callStack().slice())
      .build()
    );
  }

  /**
   * Describes how the document should be serialized.
   * @returns an object with the properties associated
   * with the JSON representation of the data envelope.
   */
  toJSON() {
    return ({
      chainId: this.props.chainId,
      source: this.props.source.toJSON(),
      document: this.props.document.toJSON(),
      metadata: this.props.metadata,
      callStack: this.props.callStack
    });
  }
}
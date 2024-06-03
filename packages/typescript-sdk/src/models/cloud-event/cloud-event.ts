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
import { randomUUID } from 'crypto';
import { DataEnvelope } from './data-envelope';
import { EventType } from './event-type';
import { ReferenceResolver } from '../../references/';
import { IReference } from '../../references/types';
import { GraphResolver } from '../../ontology/graph-resolver';
import { DirectedGraph } from 'graphology';

/**
 * The current specification version
 * of the cloud event.
 */
export const CLOUD_EVENT_SPEC_VERSION = '1.0';

/**
 * Properties required to construct
 * a cloud event.
 */
export const CloudEventSchema = z.object({

  /**
   * The cloud event specification version.
   * This version guarantees the structure
   * of the event.
   * @default 1.0
   */
  specversion: z
    .string()
    .describe('The version associated with the event format.')
    .default(CLOUD_EVENT_SPEC_VERSION),

  /**
   * A unique identifier for the event.
   * @default a randomly generated UUID.
   */
  id: z
    .string()
    .describe('A unique identifier for the event.')
    .default(() => randomUUID()),

  /**
   * The type of the event.
   * @see EventType
   */
  type: z
    .nativeEnum(EventType)
    .describe('The type of the event.'),

  /**
   * The time at which the event was created
   * in ISO 8601 format and UTC timezone.
   * @default the current time.
   */
  time: z
    .string()
    .describe('The date and time when the event has been created.')
    .default(() => new Date().toISOString()),

  /**
   * The data envelope associated with the
   * cloud event.
   * @see DataEnvelope
   */
  data: z.preprocess((data: any) => {
    return (data instanceof DataEnvelope ? data : DataEnvelope.from(data));
  }, z.instanceof(DataEnvelope))
  .describe('The data envelope containing information about the document being processed.')
}).strict();

/**
 * The cloud event properties type.
 */
type CloudEventProps = z.infer<typeof CloudEventSchema>;

/**
 * Builder for the cloud event.
 */
class Builder {

  /**
   * The properties of the cloud event.
   */
  private props: Partial<CloudEventProps> = {};

  constructor() {
    this.props.specversion = CLOUD_EVENT_SPEC_VERSION;
    this.props.id = randomUUID();
    this.props.time = new Date().toISOString();
  }

  /**
   * @param specversion the specification version of the
   * cloud event.
   * @returns the builder instance.
   */
  public withSpecVersion(specversion: string) {
    this.props.specversion = specversion;
    return (this);
  }

  /**
   * @param id the id of the cloud event.
   * @returns the builder instance.
   */
  public withId(id: string) {
    this.props.id = id;
    return (this);
  }

  /**
   * @param time the time the cloud event was created.
   * @returns the builder instance.
   */
  public withTime(time: string) {
    this.props.time = time;
    return (this);
  }

  /**
   * @param type the type associated with the event.
   * @returns the builder instance.
   */
  public withType(type: EventType) {
    this.props.type = type;
    return (this);
  }

  /**
   * @param data the data envelope associated
   * with the cloud event.
   * @returns the builder instance.
   */
  public withData(data: DataEnvelope) {
    this.props.data = data;
    return (this);
  }

  /**
   * @returns a new cloud event instance.
   */
  public build(): CloudEvent {
    return (new CloudEvent(CloudEventSchema.parse((this.props))));
  }
}

/**
 * A cloud event is a data structure that is at the core
 * of the events exchanged between middlewares. It contains
 * a description of the event received or emitted by a middleware,
 * information about the document associated with the event,
 * and all the metadata required by middlewares to make informed
 * decisions about how to process as document.
 * @note This data structure follows the official CloudEvents
 * specification (https://cloudevents.io/).
 */
export class CloudEvent {

  /**
   * The builder class for building a new
   * cloud event instance.
   */
  static Builder = Builder;

  constructor(public props: CloudEventProps) {}

  /**
   * @param props the properties of the cloud event.
   * This can be either a JSON string or an object.
   * @returns a new cloud event instance constructed
   * from the given properties.
   * @throws an error if the properties are invalid.
   */
  static from(props: string | object): CloudEvent {
    if (typeof props === 'string') {
      props = JSON.parse(props);
    }
    return (new CloudEvent(CloudEventSchema.parse((props))));
  }

  /**
   * @returns the data envelope object associated
   * with the cloud event.
   */
  data(): DataEnvelope {
    return (this.props.data);
  }

  /**
   * @returns the specification version of the
   * cloud event.
   */
  specVersion(): string {
    return (this.props.specversion);
  }

  /**
   * @returns the event unique identifier.
   */
  id(): string {
    return (this.props.id);
  }

  /**
   * @returns the type of the cloud event.
   */
  type(): EventType {
    return (this.props.type);
  }

  /**
   * @returns the time at which the cloud event
   * was created.
   */
  time(): string {
    return (this.props.time);
  }

  /**
   * @returns a new instance consisting of a deep copy of
   * values associated with the current cloud event.
   */
  clone(): CloudEvent {
    return (new CloudEvent.Builder()
      .withSpecVersion(this.specVersion())
      .withId(this.id())
      .withType(this.type())
      .withTime(this.time())
      .withData(this.data().clone())
      .build()
    );
  }

  /**
   * Allows to resolve a reference against the current
   * cloud event.
   * @param reference the reference to resolve.
   * @returns the value associated with the given reference.
   */
  resolve(reference: IReference<any>): Promise<any> {
    return (new ReferenceResolver(this).resolve(reference));
  }

  /**
   * Describes how the document should be serialized.
   * @returns an object with the properties associated
   * with the JSON representation of the event.
   */
  toJSON() {
    return ({
      specversion: this.specVersion(),
      id: this.id(),
      type: this.type(),
      time: this.time(),
      data: this.data().toJSON()
    });
  }

  /**
   * @returns a promise to a directed graph representation
   * of the ontology extracted from the cloud event.
   */
  asGraph(): Promise<DirectedGraph> {
    return (new GraphResolver(this).resolve());
  }
}

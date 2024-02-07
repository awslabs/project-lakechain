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

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { CloudEvent } from '../../src/models/cloud-event/cloud-event.js';
import { EventType, CLOUD_EVENT_SPEC_VERSION, DataEnvelope, Document } from '../../src/index.js';

const sampleDocument = new Document.Builder()
  .withType('application/json')
  .withUrl('s3://example.com/example.json')
  .build();

const sampleDataEnvelope = new DataEnvelope.Builder()
  .withChainId('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
  .withDocument(sampleDocument)
  .withSourceDocument(sampleDocument)
  .withMetadata({ title: 'test' })
  .build();

describe('Cloud Event Data Model', () => {

  /**
   * Minimalistic cloud event creation.
   */
  it('should be able to create a minimal cloud event', () => {
    const event = new CloudEvent.Builder()
      .withType(EventType.DOCUMENT_CREATED)
      .withData(sampleDataEnvelope)
      .build();

    assert(typeof event.id() === 'string');
    assert.strictEqual(event.type(), EventType.DOCUMENT_CREATED);
    assert.strictEqual(event.specVersion(), CLOUD_EVENT_SPEC_VERSION);
    assert.deepEqual(event.data().metadata(), { title: 'test' });
    assert(typeof event.time() === 'string');
  });

  /**
   * Complete cloud event creation.
   */
  it('should be able to create a complete cloud event', () => {
    const event = new CloudEvent.Builder()
      .withId('test')
      .withType(EventType.DOCUMENT_CREATED)
      .withSpecVersion('1.1')
      .withTime('2023-01-01T00:00:00.000Z')
      .withData(sampleDataEnvelope)
      .build();

    assert.strictEqual(event.id(), 'test');
    assert.strictEqual(event.type(), EventType.DOCUMENT_CREATED);
    assert.strictEqual(event.time(), '2023-01-01T00:00:00.000Z');
    assert.strictEqual(event.specVersion(), '1.1');
  });

  /**
   * Cloud event creation with empty parameters.
   */
  it('should not be able to create an empty event', () => {
    try {
      new CloudEvent.Builder().build();
      assert(false);
    } catch (error) {
      assert(true);
    }
  });

  /**
   * Cloud event creation from valid object.
   */
  it('should be able to deserialize a valid object', () => {
    // Minimalistic document.
    let event = CloudEvent.from({
      type: EventType.DOCUMENT_CREATED,
      data: sampleDataEnvelope.toJSON()
    });

    assert(typeof event.id() === 'string');
    assert.strictEqual(event.type(), EventType.DOCUMENT_CREATED);
    assert.strictEqual(event.specVersion(), CLOUD_EVENT_SPEC_VERSION);
    assert(typeof event.time() === 'string');

    // Complete document.
    event = CloudEvent.from({
      type: EventType.DOCUMENT_CREATED,
      id: 'test',
      specversion: '1.1',
      time: '2023-01-01T00:00:00.000Z',
      data: sampleDataEnvelope.toJSON()
    });

    assert.strictEqual(event.id(), 'test');
    assert.strictEqual(event.type(), EventType.DOCUMENT_CREATED);
    assert.strictEqual(event.time(), '2023-01-01T00:00:00.000Z');
    assert.strictEqual(event.specVersion(), '1.1');
  });

  /**
   * Cloud event creation from invalid object.
   */
  it('should not be able to deserialize an invalid object', () => {
    assert.throws(() => {
      CloudEvent.from({});
      CloudEvent.from({ type: EventType.DOCUMENT_CREATED });
      CloudEvent.from({ data: sampleDataEnvelope.toJSON() });
    });
  });

  /**
   * Cloud event creation from valid JSON string.
   */
  it('should be able to deserialize a valid JSON string', () => {
    const event = CloudEvent.from(JSON.stringify({
      type: EventType.DOCUMENT_CREATED,
      data: sampleDataEnvelope.toJSON()
    }));

    assert(typeof event.id() === 'string');
    assert.strictEqual(event.type(), EventType.DOCUMENT_CREATED);
    assert.strictEqual(event.specVersion(), CLOUD_EVENT_SPEC_VERSION);
    assert(typeof event.time() === 'string');
  });

  /**
   * Cloud event creation from invalid JSON string.
   */
  it('should not be able to deserialize an invalid JSON string', () => {
    assert.throws(() => {
      CloudEvent.from('');
      CloudEvent.from('{}');
    });
  });
});

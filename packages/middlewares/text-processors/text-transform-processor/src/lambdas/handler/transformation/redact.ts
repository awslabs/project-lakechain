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

import { CloudEvent, Entity, Pii } from '@project-lakechain/sdk/models';

/**
 * @param event the event associated with the received document.
 * @param filters an optional array of filters to apply on the
 * PII types.
 * @returns an array of PII entities.
 */
const getPii = async (event: CloudEvent, filters?: any): Promise<Pii[]> => {
  const metadata = event.data().metadata();

  if (metadata.properties?.kind !== 'text'
    || !metadata.properties?.attrs.pii) {
    return ([]);
  }

  // Resolve the PII entities.
  let pii = await metadata.properties.attrs.pii.resolve();

  // Filter the PII by type if filters are defined.
  if (filters?.length > 0) {
    pii = pii.filter(p => filters.some((f: string) => f === p.type()));
  }

  return (pii);
};

/**
 * @param event the event associated with the received document.
 * @param filters an optional array of filters to apply on the
 * entity types.
 * @returns an array of entities.
 */
const getEntities = async (event: CloudEvent, filters?: any): Promise<Entity[]> => {
  const metadata = event.data().metadata();

  if (metadata.properties?.kind !== 'text'
    || !metadata.properties?.attrs.entities) {
    return ([]);
  }

  // Resolve the entities.
  let entities = await metadata.properties.attrs.entities.resolve();

  // Filter the entities by type if filters are defined.
  if (filters?.length > 0) {
    entities = entities.filter(p => filters.some((f: string) => f === p.type()));
  }

  return (entities);
}

export const redact = async (text: string, event: CloudEvent, params: any): Promise<string> => {
  let piis: Pii[]         = [];
  let entities: Entity[]  = [];

  // Load the PII and Entities.
  for (const subject of params.subjects) {
    if (subject.name === 'pii') {
      piis = await getPii(event, subject.filter);
    } else if (subject.name === 'entities') {
      entities = await getEntities(event, subject.filter);
    }
  }

  // Merge PII and Entities into a single array while keeping them sorted and interleaved.
  const merged = piis
    .concat(entities)
    .sort((a, b) => a.startOffset() - b.startOffset());

  // Redact the entities.
  for (let i = merged.length - 1; i >= 0; i--) {
    const entity = merged[i] as any;
    const value  = entity.tag ? entity.tag() : entity.type();
    text = text.slice(0, entity.startOffset()) + value + text.slice(entity.endOffset());
  }

  return (text);
};
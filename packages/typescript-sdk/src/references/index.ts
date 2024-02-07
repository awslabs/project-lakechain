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

import get from 'lodash/get';

import { CloudEvent } from '../models/cloud-event/cloud-event';
import { createDataSource } from '../models/document/data-sources/factory';
import {
  IReference,
  IReferenceSubject,
  IUrlSubject,
  IAttributeSubject,
  IValueSubject,
  IPointerSubject
} from './types';

/**
 * A helper that allows to resolve references
 * against a cloud event.
 */
export class ReferenceResolver {

  /**
   * `ReferenceResolver` constructor.
   * @param event the cloud event to resolve the
   * reference against.
   */
  constructor(private event: CloudEvent) {}

  /**
   * Resolves a URL reference.
   * @param reference the reference to resolve.
   * @returns
   */
  private resolveUrl(reference: IReference<IUrlSubject>): Promise<Buffer> {
    return (createDataSource(reference.subject.url).asBuffer());
  }

  /**
   * Resolves an attribute reference.
   * @param reference the reference to resolve.
   */
  private resolveAttribute(reference: IReference<IAttributeSubject>): any {
    const value = get(this.event.toJSON(), reference.subject.attribute);

    if (!value) {
      throw new Error(`Attribute ${reference.subject.attribute} not found.`);
    }
    return (value);
  }

  /**
   * Resolves a value reference.
   * @param reference the reference to resolve.
   */
  private resolveValue(reference: IReference<IValueSubject>): any {
    return (reference.subject.value);
  }

  /**
   * Resolves a pointer reference.
   * @param reference the reference to resolve.
   */
  private resolvePointer(reference: IReference<IPointerSubject>): Promise<Buffer> {
    const value = get(this.event.toJSON(), reference.subject.pointer);

    if (!value) {
      throw new Error(`Attribute ${reference.subject.pointer} not found.`);
    }
    return (createDataSource(value).asBuffer());
  }

  /**
   * Resolves the given reference against the
   * cloud event.
   * @param reference the reference to resolve.
   */
  public async resolve<T extends IReferenceSubject>(reference: IReference<T>): Promise<any> {
    switch (reference.subject.type) {
      case 'url':
        return (this.resolveUrl(reference as IReference<IUrlSubject>));
      case 'attribute':
        return (this.resolveAttribute(reference as IReference<IAttributeSubject>));
      case 'value':
        return (this.resolveValue(reference as IReference<IValueSubject>));
      case 'pointer':
        return (this.resolvePointer(reference as IReference<IPointerSubject>));
      default:
        throw new Error('Invalid reference subject type');
    }
  }
}
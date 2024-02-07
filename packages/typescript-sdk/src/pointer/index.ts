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

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { DataSource, createDataSource } from '../models/document/data-sources';

/**
 * A builder class used to create a pointer.
 */
export class PointerBuilder<T> {
  private uri: URL;
  private classType: any;

  /**
   * @param uri the URI pointing to the external data source.
   * @returns the builder instance.
   */
  public withUri(uri: string | URL) {
    this.uri = typeof uri === 'string' ? new URL(uri) : uri;
    return (this);
  }

  /**
   * @param classType the class type of the data model
   * that is associated with the pointer.
   * @returns the builder instance.
   */
  public withClassType(classType: any) {
    this.classType = classType;
    return (this);
  }

  /**
   * @returns a new pointer instance.
   */
  public build(): Pointer<T> {
    if (!this.uri) {
      throw new Error('A URI is required to build a pointer');
    }
    if (!this.classType) {
      throw new Error('A class type is required to build a pointer');
    }

    return new Pointer<T>(this.uri, this.classType);
  }
}

/**
 * A pointer is a class that represents a reference
 * to an external data model. It is used to de-serialize
 * data models that are stored in external data sources.
 * Pointers are used for large data types that are not
 * suitable for being exchanged over size limited mediums
 * such as a queue or a message bus.
 * The semantics of a pointer revolves around the storage
 * of a URI that points to the external data source, as well
 * as the type of the data model that is associated with
 * the pointer.
 */
export class Pointer<T> {

  /**
   * The URI pointing to the external data source.
   */
  private uri: URL;

  /**
   * The data source which provides the concrete
   * implementation to fetch the data located at
   * the URI.
   */
  private dataSource: DataSource;

  /**
   * A class reference to the data model that
   * is associated with the pointer.
   */
  private classType: any;

  /**
   * A reference to the resolved data. This provides
   * a caching mechanism to avoid fetching the data
   * multiple times.
   */
  private value: T | null;

  /**
   * Creates a new pointer instance.
   * @param uri the URI pointing to the external
   * data source.
   * @param classType the class reference to the
   * data model that is associated with the pointer.
   */
  constructor(uri: URL, classType: any) {
    this.uri = uri;
    this.dataSource = createDataSource(uri);
    this.classType = classType;
    this.value = null;
  }

  /**
   * Resolves the pointer by loading the data associated
   * with the pointer URI in memory, and de-serializes
   * the data into the data model that is associated
   * with the pointer.
   * @returns the data model instance.
   * @throws an error if the pointer could not be resolved.
   */
  async resolve(): Promise<T> {
    if (this.value) {
      return (this.value);
    }
    const data = await this.dataSource.asBuffer();
    const json = JSON.parse(data.toString());
    const type = this.classType as any;

    // If the object is constructible via a static
    // `from` method, we use this method to construct
    // the object.
    if (typeof type.from === 'function') {
      if (Array.isArray(json)) {
        this.value = json.map((item: object) => type.from(item)) as T;
        return (this.value);
      }
      return (this.value = type.from(json));
    }

    // Otherwise we cast the object using the class
    // transformer library.
    return (this.value = plainToInstance(type, json) as T);
  }

  /**
   * @returns the URI pointing to the external data source.
   */
  getUri(): URL {
    return (this.uri);
  }

  /**
   * @returns whether the pointer has been resolved.
   */
  isResolved(): boolean {
    return (this.value !== null);
  }

  /**
   * @returns the JSON representation of the class.
   */
  toJSON() {
    return (this.uri.toString());
  }
}

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

/**
 * Type of a URL subject.
 */
export type IUrlSubject = {
  type: 'url',
  url: string
};

/**
 * Type of an attribute subject.
 */
export type IAttributeSubject = {
  type: 'attribute',
  attribute: string
};

/**
 * Type of a value subject.
 */
export type IValueSubject = {
  type: 'value',
  value: any
};

/**
 * Type of a pointer subject.
 */
export type IPointerSubject = {
  type: 'pointer',
  pointer: string
};

/**
 * Type of a reference subject.
 */
export type IReferenceSubject = IUrlSubject | IAttributeSubject | IValueSubject | IPointerSubject;

/**
 * A reference points to an external resource.
 * References can be used in middleware DSLs to refer
 * to a URL, or to an attribute of a document.
 */
export interface IReference<T extends IReferenceSubject> {

  /**
   * The reference subject.
   */
  subject: T;
}

/**
 * Allows to identify an external resource as a URL
 * within a reference.
 * @param url the URL of the external resource.
 * @returns a URL subject.
 */
export const url = (url: string): IUrlSubject => ({
  type: 'url',
  url
});

/**
 * Allows to identify a resource as an attribute
 * of a document within a reference.
 * @param path the path of the attribute of the document.
 * @returns an attribute subject.
 */
export const attribute = (path: string): IAttributeSubject => ({
  type: 'attribute',
  attribute: path
});

/**
 * Allows to identify a resource as a pointer
 * within a reference.
 * @param path the path of the pointer attribute of the document.
 * @returns an attribute subject.
 */
export const pointer = (path: string): IPointerSubject => ({
  type: 'pointer',
  pointer: path
});

/**
 * Describes a reference to the current document.
 * @returns an pointer subject.
 */
export const document = (): IPointerSubject => pointer('data.document.url');

/**
 * Describes a reference to a value literal.
 * @param value the value literal.
 * @returns a value subject.
 */
export const value = (value: any): IValueSubject => ({
  type: 'value',
  value
});

/**
 * Allows to express a reference to an external resource.
 * @param subject the reference subject.
 * @returns a new reference.
 */
export const reference = <T extends IReferenceSubject> (subject: T): IReference<T> => ({ subject });

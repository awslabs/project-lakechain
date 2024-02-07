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

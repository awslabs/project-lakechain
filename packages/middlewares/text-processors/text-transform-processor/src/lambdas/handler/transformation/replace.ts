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

import { CloudEvent } from '@project-lakechain/sdk/models';

/**
 * Signature of a replace handler.
 */
type ReplaceFunction = (text: string, event: CloudEvent, params: any) => string;

/**
 * Replaces a string in the text.
 * @param text the text to transform.
 * @param _ the event that triggered the transformation.
 * @param params the transformation parameters.
 * @returns the transformed text.
 */
const replaceString = (text: string, _: CloudEvent, params: any): string => {
  const options = `${params.caseSensitive ? '' : 'i'}g`;
  return (text.replace(new RegExp(params.subject.value, options), params.value));
};

/**
 * A map of the different replace functions.
 */
const map: { [key: string]: ReplaceFunction } = {
  'string': replaceString
};

export const replace = (text: string, event: CloudEvent, params: any): string => {
  const f = map[params.subject.type];

  if (!f) {
    throw new Error(`Invalid subject ${params.subject.type}.`);
  }
  return (f(text, event, params));
};
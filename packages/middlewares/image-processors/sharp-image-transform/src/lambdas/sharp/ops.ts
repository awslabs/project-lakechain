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
 * @param value the value to check.
 * @returns true if the value is an object, false otherwise.
 */
const isObject = (value: any) => value !== null && typeof value === 'object';

/**
 * A custom reviver function to use with `JSON.parse`
 * in order to properly deserialize `Buffer` objects
 * and references from the event data.
 * @param key the current key being processed.
 * @param value the value associated with the key.
 * @returns the value to use for the key.
 */
const reviver = (event: CloudEvent) => (key: string, value: any) => {
  if (value?.type === 'Buffer') {
    // Buffer de-serialization.
    return (Buffer.from(value.data));
  } else if (value?.subject?.type) {
    // Reference resolution.
    return (event.resolve(value));
  }
  return (value);
};

/**
 * A helper function to recursively resolve any promises,
 * deeply nested within an object or array.
 * @param value the value to resolve.
 * @returns the resolved value.
 */
const deepResolve = async (value: any): Promise<any> => {
  if (value instanceof Promise) {
    // If it's a promise, await it
    return await value;
  } else if (Array.isArray(value)) {
    // If it's an array, recursively resolve each element
    return await Promise.all(value.map(deepResolve));
  } else if (isObject(value)) {
    // If it's an object, recursively resolve each property
    const entries: any = await Promise.all(
      Object.entries(value).map(async ([key, val]) => [key, await deepResolve(val)])
    );
    return (Object.fromEntries(entries));
  }
  return (value);
};

/**
 * A helper function that returns the operations to apply
 * to the image, ready to be passed to the sharp pipeline.
 * @param event the event to process.
 * @returns the operations to apply to the image.
 */
export const getOpts = async (event: CloudEvent) => {
  const ops = JSON.parse(process.env.SHARP_OPS ?? '[]', reviver(event));

  if (!Array.isArray(ops) || !ops.length) {
    throw new Error('No operations to apply.');
  }
  return (await deepResolve(ops));
};
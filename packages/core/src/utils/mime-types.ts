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
 * Checks if `arrayB` contains at least one MIME type that matches a MIME type in `arrayA`.
 *
 * MIME types can include wildcards, represented by an asterisk (*).
 * A wildcard can replace the entire type.
 *
 * The function is case sensitive and does not ignore whitespace.
 *
 * @param {string[]} arrayA - An array of MIME types to match against.
 * @param {string[]} arrayB - An array of MIME types to be checked for matches.
 * @returns {boolean} - Returns `true` if `arrayB` contains at least one MIME type that matches a MIME type in `arrayA`, else `false
 */
export const matchMimeTypes = (arrayA: string[], arrayB: string[]): boolean => {
  for (const mimeTypeA of arrayA) {
      for (const mimeTypeB of arrayB) {
          // Check exact match
          if (mimeTypeA === mimeTypeB) {
              return true;
          }

          // Check wildcard matches
          const [typeA, subtypeA] = mimeTypeA.split('/');
          const [typeB, subtypeB] = mimeTypeB.split('/');

          if (typeA === '*' || typeB === '*') {
              if (subtypeA === '*' || subtypeB === '*' || subtypeA === subtypeB) {
                  return true;
              }
          } else if (typeA === typeB && (subtypeA === '*' || subtypeB === '*' || subtypeA === subtypeB)) {
              return true;
          }
      }
  }
  return false;
};
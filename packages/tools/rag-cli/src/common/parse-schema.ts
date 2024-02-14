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

import { generateErrorMessage, ErrorMessageOptions } from 'zod-error';

/**
 * Options for pretty-printing the error message.
 */
const options: ErrorMessageOptions = {
  delimiter: {
    component: ' - ',
  },
  path: {
    enabled: true,
    type: 'zodPathArray',
    label: 'Path: ',
  },
  code: {
    enabled: false
  },
  message: {
    enabled: true,
    label: '',
  },
  transform: ({ errorMessage, index }) => {
    return (`❗ rag-cli - Error #${index + 1}: ${errorMessage}`);
  }
};

/**
 * A helper to validate the given options against the given schema.
 * This function also pretty-prints the error message.
 * @param schema the schema to validate the options against.
 * @param opts the options to validate.
 * @returns the validated options.
 */
export const parseSchema = (schema: any, opts: any): any => {
  const result = schema.safeParse(opts);

  if (!result.success) {
    throw new Error(generateErrorMessage(result.error.issues, options));
  }
  return (result.data);
};
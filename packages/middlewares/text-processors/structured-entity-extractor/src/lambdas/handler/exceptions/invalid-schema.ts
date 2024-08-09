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

import { ErrorObject } from 'ajv';

/**
 * An exception class conveying that the response
 * provided by the model does not adhere to the schema.
 */
export class InvalidSchemaException extends Error {
  
  /**
   * `InvalidSchemaException` constructor.
   * @param errors the errors that caused the response to be invalid.
   * @param response the response that is not valid.
   */
  constructor(private errors: ErrorObject[], private response: any) {
    super(`The extracted data are invalid : ${JSON.stringify(errors)}`);
  }

  /**
   * @returns the response that is not valid.
   */
  public getResponse(): any {
    return (this.response);
  }

  /**
   * @returns the errors that caused the response to be invalid.
   */
  public getErrors(): ErrorObject[] {
    return (this.errors);
  }
}

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
 * An exception class conveying that an S3 object
 * could not be found.
 */
export class ObjectNotFoundException extends Error {
  private key: string;

  constructor(key: string) {
    super(`Object not found: ${key}`);
    this.key = key;
  }

  /**
   * @returns the URL of the object that could not
   * be found.
   */
  public getUrl(): string {
    return (this.key);
  }
}

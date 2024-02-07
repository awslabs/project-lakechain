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

import { EventEmitter } from 'events';

/**
 * Defines the available strategies for handling text overflow.
 */
export type OverflowStrategy = 'passthrough' | 'truncate' | 'chunk';

export interface IOverflowStrategy extends EventEmitter {

  /**
   * Handles text overflow.
   * @param text the text to handle.
   * @param maxTokens the maximum number of tokens to use.
   * @returns the handled text.
   */
  handle(text: string, maxTokens: number, modelId: string): string;

  /**
   * @returns the overflow strategy identifier.
   */
  id(): OverflowStrategy;
}
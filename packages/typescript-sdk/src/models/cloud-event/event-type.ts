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
 * Describes the possible event types that
 * middlewares handle.
 */
export enum EventType {

  /**
   * An event emitted when a document is marked
   * as having been created or updated. This event
   * signals that the document likely needs to be
   * re-processed and re-indexed by middlewares
   * in the chain.
   */
  DOCUMENT_CREATED = 'document-created',

  /**
   * An event emitted when a document is marked
   * as having been deleted. This event signals
   * that the document likely needs to be removed from
   * any storage by middlewares in the chain.
   * A good practice for middlewares that don't handle
   * persistence is to simply forward this event to
   * the next middlewares in the chain.
   */
  DOCUMENT_DELETED = 'document-deleted'
}

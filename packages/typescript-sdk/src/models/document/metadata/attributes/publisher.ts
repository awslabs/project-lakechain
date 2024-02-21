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

import { z } from 'zod';

/**
 * Represents the publisher of a document, typically used to
 * identify the organization or individual responsible for the
 * publication of the document.
 * This attribute is different from the `authors` attribute, which
 * represents the authors of the document. For example, an author
 * of a news article may be a journalist, while the publisher may
 * be the news organization.
 */
export const PublisherSchema = z.object({

  /**
   * The type of the publisher (e.g., "organization").
   */
  type: z.string().optional(),

  /**
   * The name of the publisher.
   */
  name: z.string(),

  /**
   * The URL of the publisher.
   */
  url: z.string().url().optional(),

  /**
   * The logo of the publisher.
   */
  logo: z.string().url().optional()
});

export type Publisher = z.infer<typeof PublisherSchema>;

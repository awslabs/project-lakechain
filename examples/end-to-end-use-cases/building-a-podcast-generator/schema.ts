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
 * The schema of a podcast conversation item.
 */
export const ConversationItem = z.object({
  persona: z
    .enum(['guest', 'host'])
    .describe('The type of persona speaking in the conversation'),
  text: z
    .string()
    .describe('The text spoken by the persona'),
  voice: z
    .enum(['Ruth', 'Gregory'])
    .describe('The voice of the persona speaking')
});

/**
 * The schema of the podcast episode.
 */
export const schema = z.object({
  title: z
    .string()
    .describe('The title of the podcast episode'),
  conversation: z
    .array(ConversationItem)
    .describe('The conversation of the podcast episode')
});

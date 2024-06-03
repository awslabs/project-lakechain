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
 * An array of base input mime-types supported
 * by Anthropic text models.
 */
export const BASE_TEXT_INPUTS = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'application/x-subrip',
  'text/vtt',
  'application/json',
  'application/xml'
];

/**
 * An array of base output mime-types supported
 * by Anthropic multimodal models.
 */
export const BASE_IMAGE_INPUTS = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
];

/**
 * The mime-type associated with the aggregate event types.
 */
export const AGGREGATE_EVENT_TYPES = [
  'application/cloudevents+json'
];

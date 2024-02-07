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
 * The model sizes supported by Whisper.
 */
export const WhisperModelSchema = z.union([
  z.literal('tiny'),
  z.literal('tiny.en'),
  z.literal('base'),
  z.literal('base.en'),
  z.literal('small'),
  z.literal('small.en'),
  z.literal('medium'),
  z.literal('medium.en'),
  z.literal('large'),
  z.literal('large-v1'),
  z.literal('large-v2'),
  z.literal('large-v3')
]);

// The Whisper model type.
export type WhisperModel = z.infer<typeof WhisperModelSchema>;

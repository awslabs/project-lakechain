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

import * as ec2 from 'aws-cdk-lib/aws-ec2';

import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';
import { BarkVoice } from './voice';
import { BarkLanguage } from './language';

/**
 * The middleware properties.
 */
export const BarkSynthesizerPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The VPC used by the middleware.
   */
  vpc: z.custom<ec2.IVpc>(
    (data) => data instanceof ec2.Vpc,
    { message: 'A VPC instance is required by the Bark synthesizer.' }
  ),

  /**
   * An optional override for the language to assume
   * the source document being written in.
   */
  languageOverride: z
    .custom<BarkLanguage>()
    .optional(),

  /**
   * An optional mapping between a language and a voice descriptor.
   * @see https://suno-ai.notion.site/8b8e8749ed514b0cbf3f699013548683?v=bc67cff786b04b50b3ceb756fd05f68c
   */
  voiceMapping: z
    .record(z.custom<BarkLanguage>(), z.custom<BarkVoice[]>())
    .default({}),

  /**
   * The temperature to pass to the Bark generative model
   * when generating text to speech.
   */
  temperature: z
    .number()
    .min(0)
    .max(1)
    .default(0.5),

  /**
   * The maximum number of instances that
   * the cluster can have.
   * @default 5
   */
  maxInstances: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(5)
});

// Export the `BarkSynthesizerPropsSchema` type.
export type BarkSynthesizerProps = z.infer<typeof BarkSynthesizerPropsSchema>;

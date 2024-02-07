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

/**
 * Bert Extractive Summarizer properties schema.
 */
export const BertExtractiveSummarizerPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The VPC used by the middleware.
   */
  vpc: z.custom<ec2.IVpc>(
    (data) => data instanceof ec2.Vpc,
    { message: 'A VPC is required by the bert extractive summarizer middleware.' }
  ),

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
    .default(5),

  /**
   * The summarization ratio to use expressed
   * in percentage between 0.1 and 1.0.
   * @default 0.2
   */
  ratio: z
    .number()
    .min(0.1)
    .max(1.0)
    .optional()
    .default(0.2)
});

// The type of the `BertExtractiveSummarizerProps` schema.
export type BertExtractiveSummarizerProps = z.infer<typeof BertExtractiveSummarizerPropsSchema>;

import * as lambda from 'aws-cdk-lib/aws-lambda';
import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';
import { CloudEvent } from '@project-lakechain/sdk';

/**
 * A function expression that returns a boolean value.
 * @param event the cloud event to process.
 * @returns a promise resolving to a boolean value.
 */
export type ConditionalExpression = (event: CloudEvent) => Promise<boolean>;

/**
 * The middleware properties.
 */
export const ConditionPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The duration for the Condition.
   * This can be either a `cdk.Duration` to determine a relative Condition,
   * or a `Date` object to determine an absolute time at which the
   * next middlewares in the pipeline will be called.
   * @default true
   */
  conditional: z
    .union([
      z.custom<lambda.IFunction>(),
      z.custom<ConditionalExpression>(),
    ])
});

// Export the `ConditionPropsSchema` type.
export type ConditionProps = z.infer<typeof ConditionPropsSchema>;

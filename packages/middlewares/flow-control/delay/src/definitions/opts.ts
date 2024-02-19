import * as cdk from 'aws-cdk-lib';
import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';

/**
 * The middleware properties.
 */
export const DelayPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The duration for the delay, or the time at which the
   * next middlewares in the pipeline will be called.
   * This can be either a `cdk.Duration` to determine a relative delay,
   * or a `Date` object to determine an absolute time at which the
   * next middlewares in the pipeline will be called.
   */
  time: z
    .union([
      z.custom<cdk.Duration>(),
      z.instanceof(Date)
    ])
});

// Export the `DelayPropsSchema` type.
export type DelayProps = z.infer<typeof DelayPropsSchema>;

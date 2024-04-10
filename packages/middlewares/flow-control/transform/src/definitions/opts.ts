import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sdk from '@project-lakechain/sdk';
import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';

/**
 * The environment to pass to the transform expression.
 */
export type Environment = {
  STORAGE_BUCKET: string;
  LAKECHAIN_CACHE_STORAGE: string;
};

/**
 * The type of the Lakechain SDK.
 */
export type Sdk = typeof sdk;

/**
 * A transform expression is a function that takes a set of events
 * as an input, and returns the result of the transformation
 * as a set of output events.
 * @param events the cloud events to process.
 * @returns a promise resolving to the transformed cloud events.
 */
export type TransformExpression = (
  events: sdk.CloudEvent[],
  sdk: Sdk,
  environment: Environment
) => Promise<sdk.CloudEvent[] | sdk.CloudEvent>;

/**
 * The middleware properties.
 */
export const TransformPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The transform expression.
   * @default true
   */
  expression: z
    .union([
      z.custom<lambda.IFunction>(),
      z.custom<TransformExpression>(),
    ])
});

// Export the `TransformPropsSchema` type.
export type TransformProps = z.infer<typeof TransformPropsSchema>;


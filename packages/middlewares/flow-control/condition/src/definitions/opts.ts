import * as lambda from 'aws-cdk-lib/aws-lambda';
import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';
import { CloudEvent } from '@project-lakechain/sdk';

/**
 * A function expression that returns a boolean value.
 * @param event the cloud event to process.
 * @returns a promise resolving to a boolean value.
 */
export type ConditionalExpression = (event: Readonly<CloudEvent>) => Promise<boolean>;

/**
 * The middleware properties.
 */
export const ConditionPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * A conditional expression, or a lambda function which will
   * evaluate a conditional expression.
   */
  conditional: z
    .union([
      z.custom<lambda.IFunction>(),
      z.custom<ConditionalExpression>()
    ])
});

// Export the `ConditionPropsSchema` type.
export type ConditionProps = z.infer<typeof ConditionPropsSchema>;

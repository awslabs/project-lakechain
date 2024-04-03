import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';
import { ReducerStrategy } from './strategies/strategy';

/**
 * The middleware properties.
 */
export const ReducerPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The reducer strategy to use to aggregate events.
   */
  strategy: z.custom<ReducerStrategy>((value) => {
    return (typeof value !== 'undefined');
  }, {
    message: 'A strategy must be provided to the reducer middleware.'
  })
});

// Export the `ReducerPropsSchema` type.
export type ReducerProps = z.infer<typeof ReducerPropsSchema>;

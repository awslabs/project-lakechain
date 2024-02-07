import { z } from 'zod';
import { MiddlewarePropsSchema } from '@project-lakechain/core/middleware';

/**
 * The middleware properties.
 */
export const PassthroughPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * Whether to dump the metadata of the document and
   * resolve pointers into their actual values.
   * @default true
   */
  resolveMetadata: z
    .boolean()
    .optional()
    .default(true)
});

// Export the `PassthroughPropsSchema` type.
export type PassthroughProps = z.infer<typeof PassthroughPropsSchema>;

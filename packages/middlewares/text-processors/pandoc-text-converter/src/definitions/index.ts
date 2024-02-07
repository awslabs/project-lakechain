import { PandocInput } from './pandoc-input';
import { PandocOutput } from './pandoc-output';

/**
 * Describes a Pandoc conversion operation.
 */
export type PandocConversionOps = {
  from: PandocInput;
  to: Array<PandocOutput>;
};

/**
 * Creates a new Pandoc conversion operation.
 * @param input the Pandoc input type.
 */
export function from(input: PandocInput) {
  return ({
    to: (...outputs: Array<PandocOutput>): PandocConversionOps => {
      return ({
        from: input,
        to: outputs
      });
    }
  });
}
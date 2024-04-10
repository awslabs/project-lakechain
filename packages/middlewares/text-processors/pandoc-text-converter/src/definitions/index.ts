import { PandocInput } from './pandoc-input';
import { PandocOutput } from './pandoc-output';

/**
 * Describes a Pandoc conversion operation.
 */
export type PandocConversionOps = {
  from: PandocInput;
  to: Array<PandocOutput>;
  options?: Array<string>;
};

/**
 * Extends PandocConversionOps with an optional opts method.
 */
interface ExtendedPandocConversionOps extends PandocConversionOps {
  opts: (...options: Array<string>) => PandocConversionOps;
}

/**
 * Creates a new Pandoc conversion operation.
 * @param input the Pandoc input type.
 */
export function from(input: PandocInput) {
  return {
    to: (...outputs: Array<PandocOutput>): ExtendedPandocConversionOps => ({
      from: input,
      to: outputs,
      options: [],
      opts: (...options: Array<string>): PandocConversionOps => ({
        from: input,
        to: outputs,
        options: options
      })
    })
  };
}

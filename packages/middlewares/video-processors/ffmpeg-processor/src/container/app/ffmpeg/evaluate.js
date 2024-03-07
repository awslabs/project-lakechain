import {
  createContext,
  runInContext
} from 'vm';

/**
 * Environment variables.
 */
const CONDITIONAL_SYMBOL = process.env.CONDITIONAL_SYMBOL;
const CONDITIONAL = process.env.CONDITIONAL;

/**
 * Evaluates the given conditional expression and returns
 * its boolean result.
 * @param event the event to process.
 * @param opts execution options.
 * @returns a promise to the boolean result of the conditional.
 * @throws an error if the conditional expression is invalid.
 */
export const evaluateExpression = async (symbol, conditional, events, ffmpeg, opts = {}) => {
  const context = createContext({
    console,
    process,
    events,
    ffmpeg
  });

  // Run the expression within a VM.
  const res = runInContext(`${conditional}\n${symbol}(events, ffmpeg);`, context, {
    ...opts
  });

  return (res);
};

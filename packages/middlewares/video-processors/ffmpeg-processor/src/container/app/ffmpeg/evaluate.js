import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

import {
  createContext,
  runInContext
} from 'vm';

/**
 * Environment variables.
 */
const INTENT_SYMBOL = process.env.INTENT_SYMBOL;
const INTENT = process.env.INTENT;

/**
 * A set of utility functions that can be used by users
 * in intent expressions.
 */
const utils = {

  /**
   * A helper function that maps a cloud event or a document instance
   * to the path on the EFS of the associated document.
   * @param {*} input an instance of a cloud event or a document.
   * @returns a file path on the EFS.
   */
  file: (input) => {
    if (!input) {
      throw new Error('Invalid input document');
    }
    if (typeof input.id === 'function') {
      // The input is a cloud event.
      return path.join(process.cwd(), '..', 'inputs', input.data().document().id());
    } else if (typeof input.mimeType === 'function') {
      // The input is a document.
      return path.join(process.cwd(), '..', 'inputs', input.id());
    } else {
      throw new Error('Invalid input document');
    }
  },
  path
};

/**
 * Evaluates the given conditional expression and returns
 * its boolean result.
 * @param event the event to process.
 * @param opts execution options.
 * @returns a promise to the boolean result of the conditional.
 * @throws an error if the conditional expression is invalid.
 */
export const evaluateExpression = async (events, opts = {}) => {
  const context = createContext({
    console,
    process,
    events,
    ffmpeg,
    utils,
    fs,
    path
  });

  // Run the expression within a VM.
  const res = runInContext(`${INTENT}\n${INTENT_SYMBOL}(events, ffmpeg, utils);`, context, {
    ...opts
  });

  return (res);
};

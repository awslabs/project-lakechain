import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

import {
  CloudEvent,
  DocumentMetadata,
  ImageMetadata
} from '@project-lakechain/sdk/models';
import {
  createContext,
  runInContext
} from 'vm';
import { Result } from './result';

/**
 * Environment variables.
 */
const INTENT_SYMBOL = process.env.INTENT_SYMBOL;
const INTENT = process.env.INTENT;

/**
 * Evaluates the given conditional expression and returns
 * its boolean result.
 * @param event the event to process.
 * @param opts execution options.
 * @returns a promise to the boolean result of the conditional.
 * @throws an error if the conditional expression is invalid.
 */
export const evaluateExpression = async (event: CloudEvent, opts = {}) => {
  const context = createContext({
    console,
    process,
    event,
    fs,
    path,
    sharp
  });

  // Run the expression within a VM.
  const res = runInContext(`${INTENT}\n${INTENT_SYMBOL}(event, sharp);`, context, {
    ...opts
  });

  // If `res` is not a valid generator, throw an error.
  if (!res || typeof res.next !== 'function') {
    throw new Error('The expression must return an async generator.');
  }

  return (res);
};

/**
 * Processes the given event using the given expression.
 * @param event the event to process.
 * @returns an async generator of processed images.
 */
export async function* processFunclet(event: CloudEvent): AsyncGenerator<Result, void, any> {
  const results = await evaluateExpression(event);
  const metadata = {
    properties: {
      kind: 'image',
      attrs: {} as ImageMetadata
    }
  };
  
  // We transform each yielded image into a buffer and
  // extract its metadata.
  for await (const transform of results) {
    const buffer = await transform.toBuffer();
    const image = await sharp(buffer).metadata();

    // Adding image dimensions to the document metadata.
    if (image.width && image.height) {
      metadata.properties.attrs.dimensions = {
        width: image.width,
        height: image.height
      };
    }

    yield {
      buffer,
      ext: image.format!,
      type: `image/${image.format}`,
      metadata: metadata as DocumentMetadata
    };
  }
}

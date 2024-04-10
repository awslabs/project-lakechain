import * as sdk from '@project-lakechain/sdk';
import { tracer } from '@project-lakechain/sdk/powertools';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

import {
  createContext,
  runInContext,
  RunningCodeOptions
} from 'vm';

/**
 * Environment variables.
 */
const TRANSFORM_EXPRESSION_TYPE = process.env.TRANSFORM_EXPRESSION_TYPE;
const TRANSFORM_EXPRESSION_SYMBOL = process.env.TRANSFORM_EXPRESSION_SYMBOL;
const TRANSFORM_EXPRESSION = process.env.TRANSFORM_EXPRESSION;
const STORAGE_BUCKET = process.env.PROCESSED_FILES_BUCKET as string;
const LAKECHAIN_CACHE_STORAGE = process.env.LAKECHAIN_CACHE_STORAGE as string;

/**
 * The lambda client.
 */
const lambda = tracer.captureAWSv3Client(new LambdaClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * Synchronously invokes the transform lambda function and
 * returns its result.
 * @param event the events to process.
 * @returns a promise to an array of output events.
 * @throws an error if the conditional function failed to execute.
 */
const evaluateLambda = async (event: sdk.CloudEvent[]): Promise<sdk.CloudEvent[]> => {
  const res = await lambda.send(new InvokeCommand({
    FunctionName: TRANSFORM_EXPRESSION,
    Payload: JSON.stringify(event.map((e) => e.toJSON()))
  }));

  // If the function failed to execute, we throw an error.
  if (res.FunctionError) {
    throw new Error(res.FunctionError);
  }
  
  // Parse the result of the lambda function into a an array of cloud events.
  const payload = JSON.parse(
    new TextDecoder().decode(res.Payload as Uint8Array)
  );

  return (payload.map((e: any) => sdk.CloudEvent.from(e)));
};

/**
 * Evaluates the given transform expression and returns
 * its result.
 * @param event the events to process.
 * @param opts execution options.
 * @returns a promise to an array of output events.
 * @throws an error if the conditional expression is invalid.
 */
const evaluateExpression = async (events: sdk.CloudEvent[], opts?: RunningCodeOptions): Promise<sdk.CloudEvent[] | sdk.CloudEvent> => {
  const context = createContext({
    console,
    require,
    setTimeout,
    clearTimeout,
    process,
    Buffer,
    events,
    sdk,
    env: {
      STORAGE_BUCKET,
      LAKECHAIN_CACHE_STORAGE
    }
  });

  // Run the expression within a VM.
  const res = runInContext(`${TRANSFORM_EXPRESSION}\n${TRANSFORM_EXPRESSION_SYMBOL}(events, sdk, env);`, context, {
    ...opts
  });

  // If the expression did not return a promise, we throw an error.
  if (!res.then) {
    throw new Error('Invalid transform expression, a promise was expected.');
  }

  return (res);
};

/**
 * Evaluates the given events and returns the transformed events.
 * @param events the events to process.
 * @returns a promise to an array of output events.
 */
export const evaluate = (events: sdk.CloudEvent[]): Promise<sdk.CloudEvent[] | sdk.CloudEvent> => {
  if (TRANSFORM_EXPRESSION_TYPE === 'lambda') {
    return (evaluateLambda(events));
  } else {
    return (evaluateExpression(events));
  }
};
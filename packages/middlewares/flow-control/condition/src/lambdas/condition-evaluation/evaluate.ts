import { tracer } from '@project-lakechain/sdk/powertools';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { CloudEvent } from '@project-lakechain/sdk/models';

import {
  createContext,
  runInContext,
  RunningCodeOptions
} from 'vm';

/**
 * Environment variables.
 */
const CONDITIONAL_TYPE = process.env.CONDITIONAL_TYPE;
const CONDITIONAL_SYMBOL = process.env.CONDITIONAL_SYMBOL;
const CONDITIONAL = process.env.CONDITIONAL;

/**
 * The lambda client.
 */
const lambda = tracer.captureAWSv3Client(new LambdaClient({
  region: process.env.AWS_REGION,
  maxAttempts: 5
}));

/**
 * Synchronously invokes the conditional lambda function and
 * returns its boolean result.
 * @param event the event to process.
 * @returns a promise to the boolean result of the conditional.
 * @throws an error if the conditional function failed to execute.
 */
const evaluateLambda = async (event: CloudEvent): Promise<boolean> => {
  const res = await lambda.send(new InvokeCommand({
    FunctionName: CONDITIONAL,
    Payload: JSON.stringify(event.toJSON())
  }));

  // If the function failed to execute, we throw an error.
  if (res.FunctionError) {
    throw new Error(res.FunctionError);
  }
  
  // Parse the result of the lambda function into a boolean value.
  const payload = JSON.parse(
    new TextDecoder().decode(res.Payload as Uint8Array)
  );

  return (payload === true);
};

/**
 * Evaluates the given conditional expression and returns
 * its boolean result.
 * @param event the event to process.
 * @param opts execution options.
 * @returns a promise to the boolean result of the conditional.
 * @throws an error if the conditional expression is invalid.
 */
const evaluateExpression = async (event: CloudEvent, opts?: RunningCodeOptions): Promise<boolean> => {
  const context = createContext({
    console,
    require,
    setTimeout,
    setInterval,
    setImmediate,
    event
  });

  // Run the expression within a VM.
  const res = runInContext(`${CONDITIONAL}\n${CONDITIONAL_SYMBOL}(event);`, context, {
    timeout: 10_000,
    ...opts
  });

  // If the expression did not return a promise, we throw an error.
  if (!res.then) {
    throw new Error(`
      Invalid conditional expression return type, a promise is expected.
    `);
  }

  return ((await res) === true);
};

/**
 * Evaluates the given conditional and returns its boolean result.
 * @param event the event to process.
 * @returns a promise to the boolean result of the conditional.
 */
export const evaluate = (event: CloudEvent): Promise<boolean> => {
  if (CONDITIONAL_TYPE === 'lambda') {
    return (evaluateLambda(event));
  } else {
    return (evaluateExpression(event));
  }
};
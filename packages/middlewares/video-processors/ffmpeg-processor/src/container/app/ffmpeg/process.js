import { CloudEvent } from '@project-lakechain/sdk/models';
import { evaluateExpression } from './evaluate.js';

/**
 * The input document events to process.
 */
const events = JSON
  .parse(process.argv[2])
  .map((event) => CloudEvent.from(event));

/**
 * Execute the user-provider function in the virtual machine.
 */
(async () => {
  const res = await evaluateExpression(events);
  if (typeof res.on === 'function') {
    res.on('end', () => console.log('Processing successfully finished'));
  }
})();

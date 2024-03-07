import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

import { CloudEvent } from '@project-lakechain/sdk/models';
import { evaluateExpression } from './evaluate.js';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * The input document events to process.
 */
const events = JSON
  .parse(process.argv[2])
  .map((event) => CloudEvent.from(event));


export const patch = (f) => {
  return function () {
    // Patch the input function.
    const originalInput = f.input;
    f.input
      = f.addInput
      = f.addInputs
      = function (document) {
        if (!document.etag) {
          throw new Error('Invalid input document');
        }
        const inputsDir = path.join(process.cwd(), '..', 'inputs', document.etag());
        return (originalInput.call(this, inputsDir));
      };
    return (f);
  };
};

const exec = (events, ffmpeg) => {
  return ffmpeg()
    .input(events[0].data().document())
    .screenshots({
      count: 6
    })
    .save('ffmpeg2.mp3');
};

(async () => {
  // Execute the user-provider function in the virtual machine.
  const res = await evaluateExpression(
    '__callable',
    `const __callable = ${exec.toString()}`,
    events,
    patch(ffmpeg())
  );

  res.on('end', () => console.log('Processed successfully finished'));
})();

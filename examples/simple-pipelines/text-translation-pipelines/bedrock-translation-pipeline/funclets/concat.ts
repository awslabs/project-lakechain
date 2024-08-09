import { TextMetadata } from '@project-lakechain/sdk';
import {
  CloudEvent,
  Sdk,
  Environment
} from '@project-lakechain/transform';

/**
 * This transform expression is called by the transform middleware
 * to concatenate all the translated chunks into a single text file.
 * @param events the input events.
 * @param sdk a reference to the Lakechain SDK.
 * @param env the function environment.
 * @returns a collection of events containing the text to synthesize.
 */
export const concat = async (events: CloudEvent[], sdk: Sdk, env: Environment) => {
  let text = Buffer.from('', 'utf-8');
  const id = `${events[0].data().chainId()}/translated`;

  // Sort the chunks by order.
  const sorted = events.sort((a, b) => {
    const ma = a.data().metadata().properties?.attrs as TextMetadata;
    const mb = b.data().metadata().properties?.attrs as TextMetadata;
    return ((ma.chunk?.order as number) - (mb.chunk?.order as number));
  });

  // Concatenate all the translated chunks.
  for (const event of sorted) {
    const document = event.data().document();
    const content  = (await document.data().asBuffer()).toString('utf-8');
    const result   = JSON.parse(content).translationResult;
    text = Buffer.concat([
      text,
      Buffer.from(result, 'utf-8'),
      Buffer.from('\n\n')
    ]);
  }

  // Create a new document containing the translated chunks.
  const doc = await sdk.Document.create({
    url: `s3://${env.STORAGE_BUCKET}/${id}`,
    type: 'text/plain',
    data: text
  });

  // Update the event with the new document.
  events[0].data().document().props = {
    url: doc.url(),
    type: doc.mimeType(),
    size: doc.size(),
    etag: doc.etag()
  };

  return (events[0]);
};

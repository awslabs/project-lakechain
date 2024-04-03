import {
  CloudEvent,
  Sdk,
  Environment
} from '@project-lakechain/transform';

/**
 * This transform expression is called by the transform middleware
 * to transform the output of the LLM into a collection of text
 * ready to be synthesized into speech.
 * The LLM does not necessarily always return a valid JSON output,
 * and this function attempts to parse the output and ensure it is
 * valid.
 * @param events the input events.
 * @param sdk a reference to the Lakechain SDK.
 * @param env the function environment.
 * @returns a collection of events containing the text to synthesize.
 */
export const parseExpression = async (events: CloudEvent[], sdk: Sdk, env: Environment) => {
  const document = events[0].data().document();
  const buffer   = (await document.data().asBuffer()).toString('utf-8');
  let dirty      = null;

  // We first check if the document is a valid JSON.
  try {
    JSON.parse(buffer);
    if (!Array.isArray(dirty)) {
      throw new Error('The document is not an array');
    }
  } catch (err) {
    // If the document is not a valid JSON, we parse the content
    // of the document until we find the start of the JSON document.
    const str = buffer.match(/\[.*?\]/s);
    if (!str) {
      throw new Error('No valid JSON found in the document');
    }
    // We parse the JSON document.
    dirty = JSON.parse(str[0]);
  }

  try {
    // If the JSON was invalid, we create a new document with the
    // new JSON.
    if (dirty) {
      const id = `${events[0].data().chainId()}/chapters.json`;
      const doc = await sdk.Document.create({
        url: `s3://${env.STORAGE_BUCKET}/${id}`,
        type: 'application/json',
        data: Buffer.from(JSON.stringify(dirty))
      });
      events[0].data().document().props = {
        url: doc.url(),
        type: doc.mimeType(),
        size: doc.size(),
        etag: doc.etag()
      };
    }
  } catch (err) {
    console.error(err);
    throw err;
  }

  return (events);
};

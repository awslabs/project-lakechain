import {
  CloudEvent as InputEvent,
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
export const transformExpression = async (events: InputEvent[], sdk: Sdk, env: Environment) => {
  const outputs  = [];
  const document = events[0].data().document();
  const buffer   = (await document.data().asBuffer()).toString('utf-8');
  let json       = null;

  // We first check if the document is a valid JSON.
  try {
    json = JSON.parse(buffer);
    if (!Array.isArray(json)) {
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
    json = JSON.parse(str[0]);
  }

  // For each conversation, we create a new document containing
  // the conversation, and update the document metadata to include
  // the voice used to synthesize the conversation, and the order
  // of the conversation in the original document.
  try {
    for (const [idx, conversation] of json.entries()) {
      const event    = events[0].clone();
      const metadata = event.data().metadata();
      const id       = `${event.data().chainId()}/${idx}`;

      // Create a new document containing the conversation.
      const doc = await sdk.Document.create({
        url: `s3://${env.STORAGE_BUCKET}/${id}`,
        type: 'text/plain',
        data: Buffer.from(conversation.text, 'utf-8')
      });

      // Update the event with the new document.
      event.data().document().props = {
        url: doc.url(),
        type: doc.mimeType(),
        size: doc.size(),
        etag: doc.etag()
      };

      // Update the metadata with the voice and order of the conversation.
      Object.assign(metadata, {
        custom: { voice: conversation.voice },
        properties: {
          kind: 'text',
          attrs: {
            chunk: {
              id,
              order: idx
            }
          }
        }
      });
      
      outputs.push(event);
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
  return (outputs);
};

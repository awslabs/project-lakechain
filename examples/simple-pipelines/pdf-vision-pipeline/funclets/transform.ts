import {
  CloudEvent,
  Sdk,
  Environment
} from '@project-lakechain/transform';

/**
 * This funclet takes a collection of input text documents as an input produced
 * by either the PDF processor for simple pages, or the Anthropic Processor for
 * more complex pages. It concatenates the text from the input documents into a
 * single output document.
 * @param events the collection of input documents.
 * @param sdk an instance of the Lakechain SDK.
 * @param environment the environment configuration.
 * @returns a new event with the concatenated text.
 */
export const concat = async (events: CloudEvent[], sdk: Sdk, environment: Environment) => {
  let result = '';
  const text = events
    // Filter out non-text documents.
    .filter((event) => event.data().document().mimeType() === 'text/plain')
    // Sort the text documents by page number.
    .sort((a, b) => {
      const pageA = a.data().metadata().properties;
      const pageB = b.data().metadata().properties;

      if (pageA?.kind === 'text' && pageB?.kind === 'text') {
        return (pageA.attrs.page! - pageB.attrs.page!);
      }
      return (0);
    });
  
  // Concatenate the text into a single document.
  for (const event of text) {
    const data = (await event.data().document().data().asBuffer()).toString('utf-8');
    result += `${data}\n\n`;
  }

  // Create a new document with the concatenated text.
  const output = await sdk.Document.create({
    url: `s3://${environment.STORAGE_BUCKET}/${events[0].data().document().filename().basename()}`,
    type: 'text/plain',
    data: Buffer.from(result, 'utf-8')
  });

  // Create a new event.
  return (new sdk.CloudEvent.Builder()
    .withId(events[0].id())
    .withType(events[0].type())
    .withData(new sdk.DataEnvelope.Builder()
      .withCallStack(events[0].data().callStack())
      .withChainId(events[0].data().chainId())
      .withSourceDocument(events[0].data().source())
      .withDocument(output)
      .withMetadata({})
      .build()
    )
    .build()
  );
};

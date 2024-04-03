import {
  CloudEvent,
  Sdk,
  Environment
} from '@project-lakechain/transform';

/**
 * This transform expression is called by the transform middleware
 * to re-package plain text translations into the SRT format.
 * @param events the input events.
 * @param sdk a reference to the Lakechain SDK.
 * @param env the function environment.
 * @returns a collection of events containing the text to synthesize.
 */
export const repackageSubtitles = async (events: CloudEvent[], sdk: Sdk, env: Environment) => {
  const video = events.find((event) => event.data().document().mimeType() === 'video/mp4');
  const translated = events.filter((event) => event.data().document().mimeType() === 'text/plain');
  const json = events.find((event) => event.data().document().mimeType() === 'application/json');

  try {
    if (!video || !json || !translated.length) {
      throw new Error('Invalid input documents');
    }

    // The outputs events to forward to the next middlewares.
    const outputs: CloudEvent[] = [video];

    // Parse the JSON description of the subtitles.
    const description = JSON.parse((await json.data().document().data().asBuffer()).toString('utf-8'));
  
    // Re-package the translated files into the SRT format.
    for (const event of translated) {
      const cloned = event.clone();
      const doc    = cloned.data().document();
      const text   = (await cloned.data().document().data().asBuffer()).toString('utf-8');
      const lines  = text.split('\r\n\r\n');
      
      // Re-package the translated text into the SRT format.
      const srt = lines.reduce((acc, item, idx) => {
        const element = description[idx];
        return (`${acc}${element.id}\r\n${element.startTime} --> ${element.endTime}\r\n${item}\r\n\r\n`);
      }, '');

      // Update the document with the new SRT content.
      cloned.data().props.document = await sdk.Document.create({
        url: `s3://${env.STORAGE_BUCKET}/${cloned.data().chainId()}/${doc.filename().basename()}`,
        type: 'application/x-subrip',
        data: Buffer.from(srt, 'utf-8')
      });

      outputs.push(cloned);
    }

    return (outputs);
  } catch (err) {
    console.error(err);
    throw err;
  }
};

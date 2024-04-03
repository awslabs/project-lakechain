import path from 'path';

/**
 * This function will download the documents on the
 * elastic file system for them to be processed by FFMPEG.
 * This function will only download documents if they are
 * not already stored locally.
 * All downloads are made using streams, and in parallel, such
 * that we parallelize downloads while not loading the entire
 * documents in memory.
 * @param {*} events an array of cloud events.
 * @param {*} opts options for the download process.
 * @return a promise that resolves when all documents are downloaded.
 */
export const download = async (events, { directory }) => {
  const promises = [];

  // Download the documents in parallel.
  for (const event of events) {
    const document = event.data().document();
    const destination = path.join(directory, document.id());
    promises.push(document.data().asFile(destination));
  }
  return (Promise.all(promises));
};
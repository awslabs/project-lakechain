import { CloudEvent, TextMetadata } from '@project-lakechain/sdk';

/**
 * This conditional expression is called by the reducer middleware
 * to check if the total number of aggregated events matches the
 * total number of produced chunks.
 * @param events the event to process.
 * @param storedEvents the list of events stored in the table.
 * @returns a promise resolving to a boolean value.
 */
export const conditional = async (event: CloudEvent, storedEvents: CloudEvent[]) => {
  const metadata = event.data().metadata().properties?.attrs as TextMetadata;

  // Check if the total number of aggregated events matches
  // the total number of produced chunks.
  return (storedEvents.length === metadata.chunk?.total);
};

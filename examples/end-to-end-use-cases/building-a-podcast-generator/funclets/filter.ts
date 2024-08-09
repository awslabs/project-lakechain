import { CloudEvent } from '@project-lakechain/condition';

/**
 * A predicate that filters out all RSS feed items
 * that have not been created today.
 * @param event the input cloud event.
 * @returns a boolean indicating whether the event should be
 * filtered out or not.
 */
export const filterOut = async (event: Readonly<CloudEvent>) => {
  const metadata = event.data().metadata();
  // If there is no creation date to the feed item, we skip the event.
  if (!metadata.createdAt) {
    return (false);
  }
  return (new Date(metadata.createdAt).toDateString() === new Date().toDateString());
};

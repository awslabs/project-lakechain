import { DocumentMetadata, DocumentMetadataSchema } from '@project-lakechain/sdk';
import { Pointer } from '@project-lakechain/sdk/pointer';

/**
 * Walks down all the metadata attributes, and resolves
 * all pointers into their actual values. The metadata
 * will be copied and returned as a new deep copy.
 * @param metadata the metadata to resolve.
 * @returns a new deep copy of the metadata with all
 * pointers resolved.
 */
export const resolve = async (metadata: DocumentMetadata) => {
  let copy: Record<string, any> = {};
  const original = copy;

  // Make a deep copy of the metadata.
  metadata = DocumentMetadataSchema.parse(
    JSON.parse(JSON.stringify(metadata))
  );

  // Recursively walk the metadata to resolve pointers
  // into their actual values.
  const walk = async (obj: any) => {
    for (const key in obj) {
      copy[key] = obj[key];
      if (obj[key] instanceof Pointer) {
        copy[key] = await obj[key].resolve();
      } else if (typeof obj[key] === 'object') {
        copy = copy[key];
        await walk(obj[key]);
      }
    }
  };

  await walk(metadata);
  return (original);
};
import { DocumentMetadata } from "@project-lakechain/sdk";

export type Result = {
  buffer: Buffer,
  ext: string,
  type: string,
  metadata: DocumentMetadata
};

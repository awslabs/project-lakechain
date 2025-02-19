import { CloudEvent } from '@project-lakechain/sdk/models';
import {
  Schema,
  Field,
  Float32,
  FixedSizeList,
  Struct,
  List,
  Int32,
  Int8,
  Utf8
} from 'apache-arrow';

/**
 * Normalizes the event to ensure it is compliant with the
 * LanceDB schema.
 * @param event the event to normalize.
 * @returns the normalized event.
 */
export const normalizeEvent = (event: CloudEvent): any => {
  const data = event.data();

  // Ensure metadata are present.
  if (!data.metadata()) {
    data.props.metadata = {};
  }

  // Ensure authors are present.
  if (!data.metadata().authors) {
    data.props.metadata.authors = [];
  }

  // Ensure keywords are present.
  if (!data.metadata().keywords) {
    data.props.metadata.keywords = [];
  }

  // Ensure topics are present.
  if (!data.metadata().topics) {
    data.props.metadata.topics = [];
  }

  return (data.toJSON());
};

/**
 * Creates the schema to store cloud events in LanceDB.
 * @param vectorSize the number of dimensions of the vector embeddings.
 */
export const makeSchema = (vectorSize: number) => {
  return (new Schema([
    // The vector embeddings.
    new Field('vector', new FixedSizeList(
      vectorSize,
      new Field('item', new Float32())
    ), false),
    
    // A unique identifier for the document.
    new Field('id', new Utf8()),

    // The text associated with the document.
    new Field('text', new Utf8()),

    // Chain identifier.
    new Field('chainId', new Utf8()),

    // Source document.
    new Field('source', new Struct([
      new Field('url', new Utf8()),
      new Field('type', new Utf8()),
      new Field('size', new Int32()),
      new Field('etag', new Utf8())
    ])),

    // Document.
    new Field('document', new Struct([
      new Field('url', new Utf8()),
      new Field('type', new Utf8()),
      new Field('size', new Int32()),
      new Field('etag', new Utf8())
    ])),

    // Metadata.
    new Field('metadata', new Struct([
      new Field('type', new Utf8(), true),
      new Field('createdAt', new Utf8(), true),
      new Field('updatedAt', new Utf8(), true),
      new Field('image', new Utf8(), true),
      new Field('authors', new List(new Field('item', new Utf8(), true)), true),
      new Field('title', new Utf8(), true),
      new Field('description', new Utf8(), true),
      new Field('keywords', new List(new Field('item', new Utf8(), true)), true),
      new Field('topics', new List(new Field('item', new Utf8(), true)), true),
      new Field('rating', new Int8(), true),
      new Field('language', new Utf8(), true),
      new Field('ontology', new Utf8(), true)
    ]))
  ]));
};

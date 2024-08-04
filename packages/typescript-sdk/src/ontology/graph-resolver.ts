/*
 * Copyright (C) 2023 Amazon.com, Inc. or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { DirectedGraph } from 'graphology';
import { CloudEvent, Document, DocumentMetadata } from '../models';

/**
 * The Graph resolver is a component that is used to resolve
 * a cloud event into a graph representation.
 */
export class GraphResolver {

  /**
   * Graph resolver constructor.
   * @param event the cloud event to resolve.
   */
  constructor(private event: CloudEvent) {}

  /**
   * A helper function that returns the name of the document.
   * @param document the document instance.
   * @param metadata the metadata of the document.
   * @returns the name of the document.
   */
  private getName(document: Document, metadata: DocumentMetadata) {
    // If a title is defined, we use that.
    if (metadata.title) {
      return (metadata.title);
    }
    // Otherwise, we use the filename.
    return (document.filename().basename());
  }

  /**
   * Adds the current document to the graph with
   * its attributes.
   * @param graph the graph instance.
   * @returns a reference to the graph resolver.
   */
  private addDocument(graph: DirectedGraph) {
    const document = this.event.data().document();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { properties: _1, custom: _2, type, ...rest } = this.event.data().metadata();

    // Add the current document to the graph.
    graph.mergeNode(document.id(), {
      type: 'Document',
      attrs: {
        ...document.toJSON(),
        ...JSON.parse(JSON.stringify(rest)),
        name: this.getName(document, rest)
      }
    });

    return (this);
  }

  /**
   * Adds the source document to the graph.
   * @param graph the graph instance.
   * @returns a reference to the graph resolver.
   */
  private addSource(graph: DirectedGraph) {
    const source = this.event.data().source();
    const document = this.event.data().document();
    const metadata = this.event.data().metadata();

    // If the current document is different from
    // the source document, we create a connection
    // between them.
    if (source.id() !== document.id()) {
      graph.mergeNode(source.id(), {
        type: 'Document',
        attrs: {
          ...source.toJSON(),
          name: this.getName(source, metadata)
        }
      });

      graph.mergeEdge(document.id(), source.id(), {
        type: 'HAS_SOURCE',
        attrs: {
          description: 'The document has a source document.'
        }
      });
    }

    return (this);
  }

  /**
   * Adds the language of the document to the graph
   * as a separate node.
   * @param graph the graph instance.
   * @param document the document instance.
   * @returns a reference to the graph resolver.
   */
  private addLanguage(graph: DirectedGraph, document: Document) {
    const metadata = this.event.data().metadata();

    if (metadata.language) {
      graph.mergeNode(metadata.language, {
        type: 'Language',
        attrs: {
          name: metadata.language
        }
      });

      // Connect the document to the language.
      graph.mergeEdge(document.id(), metadata.language, {
        type: 'IS_IN_LANGUAGE',
        attrs: {
          description: 'The document is in the given language.'
        }
      });
    }

    return (this);
  }

  /**
   * Adds the topics of the document to the graph
   * as separate nodes.
   * @param graph the graph instance.
   * @param document the document instance.
   * @returns a reference to the graph resolver.
   */
  private addTopics(graph: DirectedGraph, document: Document) {
    const metadata = this.event.data().metadata();

    if (metadata.topics) {
      metadata.topics.forEach(topic => {
        graph.mergeNode(topic, {
          type: 'Topic',
          attrs: {
            name: topic
          }
        });

        // Connect the document to the topic.
        graph.mergeEdge(document.id(), topic, {
          type: 'IS_LINKED_TO',
          attrs: {
            description: 'The document is linked to the given topic.'
          }
        });
      });
    }

    return (this);
  }

  /**
   * Adds the publisher of the document to the graph
   * as a separate node.
   * @param graph the graph instance.
   * @param document the document instance.
   * @returns a reference to the graph resolver.
   */
  private addPublisher(graph: DirectedGraph, document: Document) {
    const metadata = this.event.data().metadata();

    if (metadata.publisher?.name) {
      graph.mergeNode(metadata.publisher.name, {
        type: 'Publisher',
        attrs: {
          ...metadata.publisher
        }
      });

      // Connect the document to the publisher.
      graph.mergeEdge(document.id(), metadata.publisher, {
        type: 'PUBLISHED_BY',
        attrs: {
          description: 'The document is published by the given publisher.'
        }
      });
    }

    return (this);
  }

  /**
   * Adds the authors of the document to the graph
   * as separate nodes.
   * @param graph the graph instance.
   * @param document the document instance.
   * @returns a reference to the graph resolver.
   */
  private addAuthors(graph: DirectedGraph, document: Document) {
    const metadata = this.event.data().metadata();

    if (metadata.authors) {
      metadata.authors.forEach(author => {
        graph.mergeNode(author, {
          type: 'Author',
          attrs: {
            name: author
          }
        });

        // Connect the document to the author.
        graph.mergeEdge(document.id(), author, {
          type: 'AUTHORED_BY',
          attrs: {
            description: 'The document is authored by the given author.'
          }
        });
      });
    }

    return (this);
  }

  /**
   * Adds the class of the document to the graph
   * as a separate node.
   * @param graph the graph instance.
   * @param document the document instance.
   * @returns a reference to the graph resolver.
   */
  private addClass(graph: DirectedGraph, document: Document) {
    const metadata = this.event.data().metadata();

    if (metadata.type) {
      graph.mergeNode(metadata.type, {
        type: 'Class',
        attrs: {
          name: metadata.type
        }
      });

      // Connect the document to the type.
      graph.mergeEdge(document.id(), metadata.type, {
        type: 'IS_OF_CLASS',
        attrs: {
          description: 'The document is of the given class.'
        }
      });
    }

    return (this);
  }

  /**
   * Adds the kind of the document to the graph
   * as a separate node.
   * @param graph the graph instance.
   * @param document the document instance.
   * @returns a reference to the graph resolver.
   */
  private addKind(graph: DirectedGraph, document: Document) {
    const metadata = this.event.data().metadata();

    if (metadata.properties?.kind) {
      graph.mergeNode(metadata.properties.kind, {
        type: 'Kind',
        attrs: {
          name: metadata.properties.kind
        }
      });

      // Connect the document to the kind.
      graph.mergeEdge(document.id(), metadata.properties.kind, {
        type: 'IS_OF_KIND',
        attrs: {
          description: 'The document is of the given kind.'
        }
      });
    }

    return (this);
  }

  /**
   * Adds the custom ontology to the graph.
   * @param graph the graph instance.
   * @param document the document instance.
   * @returns a reference to the graph resolver.
   */
  private async addCustomOntology(graph: DirectedGraph, document: Document) {
    const metadata = this.event.data().metadata();
    const pointer = metadata.ontology;

    if (pointer) {
      const ontology = await pointer.resolve();
      
      // Merge the ontology nodes with the graph.
      ontology.nodes().forEach(node => {
        const attrs = ontology.getNodeAttributes(node);

        // Merge the node into the graph.
        graph.mergeNode(node, attrs);

        // If the node is a head, it means it is connected
        // to the document.
        if (attrs.attrs?.isHead) {
          graph.mergeEdge(document.id(), node, {
            type: 'HAS_ONTOLOGY',
            attrs: {
              description: 'The document is connected to the custom ontology.'
            }
          });
        }
      });

      // Merge the ontology edges with the graph.
      ontology.edges().forEach(edge => {
        const source = ontology.source(edge);
        const target = ontology.target(edge);
        const attrs = ontology.getEdgeAttributes(edge);

        if (source && target) {
          // Merge the edge into the graph.
          graph.mergeEdge(source, target, attrs);
        }
      });
    }

    return (this);
  }

  /**
   * Resolve the cloud event into a graph representation.
   * @returns a graph representation of the cloud event.
   */
  async resolve(): Promise<DirectedGraph> {
    const graph = new DirectedGraph();
    const document = this.event.data().document();

    this.addDocument(graph);
    this.addSource(graph);
    this.addLanguage(graph, document);
    this.addTopics(graph, document);
    this.addPublisher(graph, document);
    this.addAuthors(graph, document);
    this.addClass(graph, document);
    this.addKind(graph, document);
    await this.addCustomOntology(graph, document);

    return (graph);
  }
}
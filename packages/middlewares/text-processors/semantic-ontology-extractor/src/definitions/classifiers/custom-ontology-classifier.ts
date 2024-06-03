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

import { z } from 'zod';
import { randomUUID } from 'crypto';
import { generateErrorMessage, ErrorMessageOptions } from 'zod-error';
import { CloudEvent, CacheStorage } from '@project-lakechain/sdk';
import { DirectedGraph } from 'graphology';
import { DefaultOntologyClassifier } from './default-ontology-classifier';
import { Prompt } from './prompt';
import { Node, NodeSchema } from '../ontology/node';
import { Edge, EdgeSchema } from '../ontology/edge';

/**
 * System prompt.
 */
const SYSTEM_PROMPT = `
You are a knowledge graph extractor that receives documents and extracts structured nodes and edges from them
to build a knowledge graph.
`;

/**
 * User prompt.
 */
const USER_PROMPT = `
Analyze the provided documents step-by-step and extract the semantic ontology from the documents in the form of
nodes and edges described into a stuctured JSON document.
Ensure the generated JSON is valid, and no strings are broken across multiple lines or in the middle with a special character.
Below is the schema of the structured JSON that you must output, use this example to format your output:

<json>
  {
    "nodes": [{
      "id": "Unique identifier of the node; no spaces",
      "type": "Type of the node",
      "isHead": "Whether the node is the head of the graph; use given value",
      "description": "Description of what the node represents",
      "props": [{
        "name": "Name of the property",
        "description": "Description of the property",
        "value": "Value of the property extracted from the document",
        "uniqueIdentifier": "Whether the property is a unique identifier for the node; use given value"
      }]
    }],
    "edges": [{
      "source": "The node source identifier",
      "target": "The node target identifier",
      "type": "The type of the edge",
      "description": "The description of the edge"
    }]
  }
</json>
`;

/**
 * An internal helper allowing to validate schemas using a
 * predefined visualization for error messages.
 * @param schema the Zod schema to use to validate the properties.
 * @param opts the options to validate.
 * @returns the parsed properties.
 */
const parse = (schema: z.ZodSchema, opts: CustomOntologyClassifierProps): any => {
  const options: ErrorMessageOptions = {
    delimiter: {
      component: ' - ',
    },
    path: {
      enabled: true,
      type: 'zodPathArray',
      label: 'Path: ',
    },
    code: {
      enabled: false
    },
    message: {
      enabled: true,
      label: '',
    },
    transform: ({ errorMessage, index }) => {
      return (`❗ Custom Ontology Classifier - Error #${index + 1}: ${errorMessage}`);
    }
  };

  const result = schema.safeParse(opts);
  if (!result.success) {
    throw new Error(generateErrorMessage(result.error.issues, options));
  }
  return (result.data);
};

/**
 * Custom ontology classifier properties.
 */
export const CustomOntologyClassifierPropsSchema = z.object({

  /**
   * A unique identifier for the classifier.
   */
  classifierType: z.literal('CUSTOM'),

  /**
   * The nodes defined in the ontology.
   * @note If set to 'automatic', the nodes are extracted automatically
   * from the documents.
   */
  nodes: z.union([
    z.literal('automatic'),
    z.array(NodeSchema).min(1)
  ])
  .refine((nodes) => {
    if (Array.isArray(nodes)) {
      return (
        // Ensure the nodes are not of restricted types.
        nodes.every((node: any) => !['Document'].includes(node.type)) &&
        // Ensure the node type does not contain spaces or special characters.
        nodes.every((node: any) => !/[^\w]/.test(node.type))
      );
    }
    return (true);
  }, {
    message: 'The node type cannot be "Document" and cannot contain spaces or special characters.'
  }),
  
  /**
   * The edges defined in the ontology.
   */
  edges: z.union([
    z.literal('automatic'),
    z.array(EdgeSchema).min(1)
  ])
});

// The type of the `CustomOntologyClassifierProps` schema.
export type CustomOntologyClassifierProps = z.infer<typeof CustomOntologyClassifierPropsSchema>;

/**
 * The custom ontology classifier builder.
 */
export class CustomOntologyClassifierBuilder {

  /**
   * The image variation task properties.
   */
  private props: Partial<CustomOntologyClassifierProps> = {
    classifierType: 'CUSTOM'
  };

  /**
   * Sets the nodes defined in the ontology.
   * @param nodes the nodes defined in the ontology.
   * @returns the current builder instance.
   */
  public withNodes(nodes: Node[] | 'automatic'): CustomOntologyClassifierBuilder {
    this.props.nodes = nodes;
    return (this);
  }

  /**
   * Sets the edges defined in the ontology.
   * @param edges the edges defined in the ontology.
   * @returns the current builder instance.
   */
  public withEdges(edges: Edge[] | 'automatic'): CustomOntologyClassifierBuilder {
    this.props.edges = edges;
    return (this);
  }

  /**
   * @returns a new instance of the `CustomOntologyClassifier`
   * classifier constructed with the given parameters.
   */
  public build(): CustomOntologyClassifier {
    return (CustomOntologyClassifier.from(this.props));
  }
}

/**
 * The custom ontology classifier.
 */
export class CustomOntologyClassifier {

  /**
   * The `CustomOntologyClassifier` Builder.
   */
  public static Builder = CustomOntologyClassifierBuilder;

  /**
   * The default classifier.
   */
  private defaultClassifier: DefaultOntologyClassifier;

  /**
   * Creates a new instance of the `CustomOntologyClassifier` class.
   * @param props the task properties.
   */
  constructor(public props: CustomOntologyClassifierProps) {
    this.defaultClassifier = new DefaultOntologyClassifier.Builder().build();
  }

  /**
   * @returns the type of the classifier.
   */
  public classifierType(): string {
    return (this.props.classifierType);
  }

  /**
   * @returns the nodes defined in the ontology.
   */
  public nodes(): Node[] | 'automatic' {
    return (this.props.nodes);
  }

  /**
   * @returns the edges defined in the ontology.
   */
  public edges(): Edge[] | 'automatic' {
    return (this.props.edges);
  }

  /**
   * Creates a new instance of the `CustomOntologyClassifier` class.
   * @param props the task properties.
   * @returns a new instance of the `CustomOntologyClassifier` class.
   */
  public static from(props: any) {
    return (new CustomOntologyClassifier(
      parse(CustomOntologyClassifierPropsSchema, props)
    ));
  }

  /**
   * @returns the prompts to execute to extract the
   * semantic ontology from documents.
   */
  public getPrompts(): Prompt[] {
    const prompts = this.defaultClassifier.getPrompts();
    let userPrompt = USER_PROMPT;

    // Nodes definition.
    if (this.nodes() === 'automatic') {
      userPrompt += `
        Define the nodes automatically based on your analysis of the documents.
        The nodes cannot be of type "Document", "Author", "Publisher", "Topic", "Class", or "Kind" as they are reserved types.
      `;
    } else {
      userPrompt += `
        Attempt to extract the following nodes from the documents.
        Only include nodes for which the properties are found in the document; do not include nodes without properties.
        <json>
          ${JSON.stringify(this.nodes(), null, 2)}
        </json>
      `;
    }

    if (this.edges() === 'automatic') {
      userPrompt += `
        Define the edges in the nodes based on your analysis of the documents.
        Create edges using capital letters and underscores such as "IS_ASSOCIATED_WITH" or "PARTICIPATED_IN".
      `;
    } else {
      userPrompt += `
        Attempt to extract the following edges from the documents.
        Only include edges for which the source and target nodes are found in the document; do not include edges without source or target nodes.
        <json>
          ${JSON.stringify(this.edges(), null, 2)}
        </json>
      `;
    }

    // Add custom prompts.
    prompts.push({
      type: 'custom',
      systemPrompt: SYSTEM_PROMPT,
      userPrompt
    });

    return (prompts);
  }

  /**
   * Validates the given node.
   * @param node the node to validate.
   * @returns `true` if the node is valid; `false` otherwise.
   */
  private isNodeValid(node: any): boolean {
    return (node
      && node.id
      && node.type
      && node.description
      && Array.isArray(node.props)
    );
  }

  /**
   * A helper defining the unique identifier of node.
   * This makes it possible to namespace nodes, and honors
   * the `uniqueIdentifier` attribute.
   * @param node the node to get the id for.
   * @returns the unique identifier of the node.
   */
  private getId(node: any): string {
    const attribute = node.props.find((prop: any) => prop.uniqueIdentifier);
    return (attribute ? `${node.type}-${attribute.value}` : `${node.type}-${randomUUID()}`);
  }

  /**
   * Creates a graph from the given JSON object.
   * @param event the cloud event to update.
   * @param json the JSON object extracted from the LLM.
   * @returns the updated cloud event.
   */
  private async makeGraph(event: CloudEvent, json: any): Promise<CloudEvent> {
    const metadata = event.data().metadata();
    const cache = new CacheStorage();
    let graph: DirectedGraph;

    // If the `custom` attribute is not present in the metadata,
    // we create it.
    metadata.custom = metadata.custom ?? {};

    // If the graph does not exist, we create it.
    if (metadata.ontology) {
      graph = await metadata.ontology.resolve();
    } else {
      graph = new DirectedGraph();
    }

    // Add the nodes to the graph.
    for (const node of json.nodes) {
      if (this.isNodeValid(node)) {
        const props: Record<string, any> = {
          type: node.type,
          attrs: {
            description: node.description,
            isHead: node.isHead
          }
        };

        // Set a unique identifier for the node.
        const id = this.getId(node);

        // Add the properties to the node.
        node.props
          .filter((prop: any) => prop.name && prop.value)
          .forEach((prop: any) => props.attrs[prop.name] = prop.value);
        
        // Add the node to the graph.
        graph.addNode(id, props);

        // Update all edges that have the node as a source or target
        // in `json.edges` to match the new node id.
        for (const edge of json.edges) {
          if (edge.source === node.id) {
            edge.source = id;
          }
          if (edge.target === node.id) {
            edge.target = id;
          }
        }
        
        // Add the nodes and their attributes to the custom
        // attribute of the document metadata.
        metadata.custom[node.type] = props.attrs;
      }
    }

    // Add the edges to the graph.
    for (const edge of json.edges) {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        graph.addEdge(edge.source, edge.target, {
          type: edge.type,
          description: edge.description
        });
      }
    }

    // Save the graph in the cache storage.
    metadata.ontology = await cache.put('ontology', graph);

    return (Promise.resolve(event));
  }

  /**
   * Updates the given cloud event based on the answer generated by the LLM
   * and the prompt.
   * @param json the JSON object extracted from the LLM.
   * @param prompt the prompt used to generate the JSON object.
   * @param event the cloud event to update.
   * @returns the updated cloud event.
   */
  public async update(json: any, prompt: Prompt, event: CloudEvent): Promise<CloudEvent> {
    if (prompt.type === 'default') {
      return (Promise.resolve(
        this.defaultClassifier.update(json, prompt, event)
      ));
    } else if (prompt.type === 'custom') {
      return (this.makeGraph(event, json));
    } else {
      throw new Error(`Unknown prompt type: ${prompt.type}`);
    }
  }

  /**
   * @returns the JSON representation of the classifier.
   */
  public toJSON() {
    return (this.props);
  }
}

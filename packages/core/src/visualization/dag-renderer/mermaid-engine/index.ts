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

import fs from 'fs';
import tmp from 'tmp';
import template from 'lodash/template';

import { Middleware } from '../../../middleware';
import { table } from 'table';
import { IRenderingEngine } from '../engine';
import { MermaidRendererProps, MermaidRendererPropsSchema } from './definitions/opts';
import { OutputFormat } from './definitions/output-format';
import { DiagramDirection } from './definitions/diagram-direction';
import { createTemplate } from './definitions/template';
import { Theme } from './definitions/theme';

/**
 * Builder for the Mermaid renderer.
 */
export class MermaidRendererBuilder {
  private props: Partial<MermaidRendererProps> = {};

  /**
   * Sets the output format for the renderer.
   * @param outputFormat the output format.
   * @returns the builder.
   */
  public withOutputFormat(outputFormat: OutputFormat): this {
    this.props.outputFormat = outputFormat;
    return (this);
  }

  /**
   * Sets the direction of the rendered graph.
   * @param direction the direction.
   * @returns the builder.
   */
  public withDirection(direction: DiagramDirection): this {
    this.props.direction = direction;
    return (this);
  }

  /**
   * Sets the theme of the rendered graph.
   * @param theme the theme.
   * @returns the builder.
   */
  public withTheme(theme: Theme): this {
    this.props.theme = theme;
    return (this);
  }

  /**
   * @returns a new instance of the DAG renderer.
   * @throws an error if the properties are invalid.
   */
  public build(): MermaidRenderer {
    return (new MermaidRenderer(this.props));
  }
}

/**
 * The Mermaid renderer provides a way to render the topology
 * of a pipeline as a graphical directed acyclic graph.
 * This implementation uses the Mermaid CLI package to transform
 * a mermaid auto-generated document into one of the supported
 * formats.
 */
export class MermaidRenderer implements IRenderingEngine {

  /**
   * The properties of the renderer.
   */
  private readonly props: MermaidRendererProps;

  /**
   * The builder for the renderer
   */
  static Builder = MermaidRendererBuilder;

  /**
   * `MermaidRenderer` constructor.
   * @param props the properties of the renderer.
   */
  constructor(props: Partial<MermaidRendererProps> = {}) {
    // Validate the properties.
    this.props = MermaidRendererPropsSchema.parse(props);
  }

  /**
   * @param middleware the consumer to get the supported
   * output types for.
   * @returns an array of supported input types for
   * the given consumer.
   */
  private formatOutputTypes(middleware: Middleware, maxTypes = 3) {
    const length = middleware.supportedOutputTypes().length;
    let types    = middleware
      .supportedOutputTypes()
      .slice(0, maxTypes)
      .reduce((acc, type) => {
        if (type.length > 50) {
          type = `${type.slice(0, 50)}...`;
        }
        acc += `${type}\\n`;
        return (acc);
      }, '');
    if (length > maxTypes) {
      types += `${length - maxTypes} more...\\n`;
    }
    return (types);
  }

  /**
   * Creates a mermaid document based on the topology
   * of the given pipeline.
   * @param middlewares the middlewares part of the pipeline
   * to render.
   * @returns a string representing the mermaid document.
   */
  private getDefinition(middlewares: Middleware[]): string {
    const tpl = template(createTemplate({
      ...this.props
    }));
    const connections = [];

    // Create the connections in the pipeline graph.
    for (const middleware of middlewares) {
      const name      = middleware.name();
      const consumers = middleware.getConsumers();

      for (const consumer of consumers) {
        const outputTypes = this.formatOutputTypes(middleware);
        const producerId  = `${middleware.node.addr}[${name}]`;
        const consumerId  = `${consumer.node.addr}[${consumer.name()}]`;
        connections.push(` ${producerId} -- ${outputTypes} --> ${consumerId}\n`);
      }
    }

    return (tpl({
      direction: this.props.direction,
      connections
    }));
  }

  async asFile(middlewares: Middleware[]): Promise<string> {
    const { run } = await import('@mermaid-js/mermaid-cli');
    const definition = this.getDefinition(middlewares);
    const definitionFile = tmp.fileSync({ postfix: '.mmd' });
    const outputFilePath = tmp.fileSync({ postfix: `.${this.props.outputFormat}` }).name;

    // Write the auto-generated Mermaid document to a temporary file.
    fs.writeFileSync(definitionFile.name, definition);
    // Invoke the Mermaid CLI.
    await run(definitionFile.name, outputFilePath, {
      quiet: true,
      puppeteerConfig: {
        headless: 'new'
      }
    });
    return (outputFilePath);
  }

  /**
   * Renders a directed acyclic graph composed of
   * the given middlewares.
   * @param middlewares the middlewares part of the pipeline
   * to render.
   */
  async render(middlewares: Middleware[]): Promise<void> {
    const outputFile = await this.asFile(middlewares);
    const data  = [[
      `✨ Mermaid diagram : ${outputFile}`
    ]];
    process.stderr.write(table(data));
  }
}
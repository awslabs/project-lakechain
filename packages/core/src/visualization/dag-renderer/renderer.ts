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

import { Middleware } from '../../middleware';
import { IRenderingEngine } from './engine';

export interface DagRendererProps {

  /**
   * The engine to use for rendering the
   * directed acyclic graph.
   */
  engine: IRenderingEngine;
}

/**
 * A facade class using rendering engines to visualize
 * directed acyclic graphs.
 */
export class DagRenderer {

  constructor(private props: DagRendererProps) {}

  /**
   * Renders the directed acyclic graph.
   */
  async render(middlewares: Middleware[]): Promise<void> {
    await this.props.engine.render(middlewares);
  }
}
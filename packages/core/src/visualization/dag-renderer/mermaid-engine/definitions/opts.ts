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
import { OutputFormatSchema } from './output-format';
import { DiagramDirectionSchema } from './diagram-direction';
import { ThemeSchema } from './theme';

/**
 * Mermaid renderer properties.
 */
export const MermaidRendererPropsSchema = z.object({

  /**
   * The output format to use when rendering
   * the pipeline as a file.
   */
  outputFormat: OutputFormatSchema
    .default('svg'),

  /**
   * The direction of the rendered graph.
   */
  direction: DiagramDirectionSchema
    .default('TD'),

  /**
   * The theme to use when rendering the
   * graph.
   */
  theme: ThemeSchema
    .default('forest')
});

// The type of the properties for the DAG renderer.
export type MermaidRendererProps = z.infer<typeof MermaidRendererPropsSchema>;
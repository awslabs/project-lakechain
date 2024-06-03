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

import { MiddlewarePropsSchema } from '@project-lakechain/core';
import { z } from 'zod';
import {
  DefaultOntologyClassifier,
  CustomOntologyClassifier
} from './classifiers';

/**
 * Semantic ontology extractor properties.
 */
export const SemanticOntologyExtractorPropsSchema = MiddlewarePropsSchema.extend({

  /**
   * The AWS region in which the model will
   * be invoked.
   */
  region: z
    .string()
    .optional(),

  /**
   * The ontology classifier to use to extract
   * semantic ontology from documents.
   * @default uses the `DefaultOntologyClassifier`.
   */
  ontologyClassifier: z.union([
    z.custom<DefaultOntologyClassifier>(),
    z.custom<CustomOntologyClassifier>()
  ])
  .default(new DefaultOntologyClassifier.Builder().build())
});

// The type of the `SemanticOntologyExtractorProps` schema.
export type SemanticOntologyExtractorProps = z.infer<typeof SemanticOntologyExtractorPropsSchema>;


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

import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [{
  files: [
    '**/*.ts',
    '**/*.js',
    '**/*.mjs'
  ],
  languageOptions: {
    ecmaVersion: 12,
    parser: tsParser,
    globals: {
      ...globals.es2022,
      ...globals.node,
      ...globals.jest,
      ...globals.browser
    }
  },
  "plugins": {
    "@typescript-eslint": tsPlugin
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/ban-ts-comment": "off"
  },
  "ignores": [
    "**/*.d.ts",
    "**/coverage",
    "**/node_modules",
    "**/dist"
  ]
}];

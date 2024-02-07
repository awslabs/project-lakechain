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

import { readFileSync } from 'fs';
import updates from 'update-notifier';
import agent from 'proxy-agent';

/**
 * Exporting the initialization routines, ensuring
 * that the environment is properly configured.
 */
export const initialization = [

  /**
   * Verifies whether a new version of the CLI is available.
   */
  (_1, _2, next) => {
    const pkg = JSON.parse(readFileSync('./package.json'));
    try {
      // Checks for updates once a day.
      updates({ pkg, updateCheckInterval: 1000 * 60 * 60 * 24 }).notify();
    } catch (e) {
      // The update checker can fail if the filesystem is read-only.
      console.warn(e);
    }
    next();
  }
];

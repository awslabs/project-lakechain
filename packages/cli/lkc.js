#!/usr/bin/env node

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
import { join, dirname } from 'path'; 
import { program } from 'commander';

// The current directory.
const __dir = new URL(dirname(import.meta.url)).pathname;

// Retrieving package informations.
const { version, description } = JSON.parse(
  readFileSync(join(__dir, 'package.json'), 'utf-8')
);

/**
 * Command-line interface.
 */
program
  .name('lkc')
  .version(version)
  .description(description)
  .command('init', 'An assistant to create a new Lakechain middleware.')
  .command('list', 'Lists all the official Lakechain packages.')
  .command('docs', 'Opens the Project Lakechain documentation.')
  .command('search <query>', 'Searches for a middleware in the official Lakechain store.')
  .command('examples', 'Download examples for Project Lakechain on the file-system.')
  .showSuggestionAfterError(true)
  .parse(process.argv);

// Error handling.
const commandExists = program.commands.some((cmd) => cmd.name() === program.args[0]);
if (!commandExists) {
  program.outputHelp();
  process.exit(-1);
}

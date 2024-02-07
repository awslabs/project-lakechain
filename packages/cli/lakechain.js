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
import { program } from 'commander';

// Retrieving package informations.
const { version, description } = JSON.parse(
  readFileSync('./package.json')
);

/**
 * Command-line interface.
 */
program
  .version(version)
  .name('lakechain')
  .description(description)
  .command('config', 'Configuration management of the Lakechain CLI.')
  .command('examples', 'Downloads examples for Project Lakchain in the current directory.')
  .command('info <packages...>', 'Displays information about one or more given middleware(s).')
  .command('init', 'Provides an assistant to create a new Lakechain middleware.')
  .command('list', 'Lists all the official Lakechain packages.')
  .command('search <query>', 'Searches for a middleware in the official Lakechain store.')
  .command('run', 'Runs a Lakechain middleware locally.')
  .showSuggestionAfterError(true)
  .parse(process.argv);

// Error handling.
const commandExists = program.commands.some((cmd) => cmd.name() === program.args[0]);
if (!commandExists) {
  program.outputHelp();
  process.exit(-1);
}

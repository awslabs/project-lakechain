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

import path from 'path';
import fs from 'fs';
import fse from 'fs-extra/esm';
import prompts from 'prompts';
import boxen from 'boxen';
import Chain from 'middleware-chain-js';
import chalk from 'chalk';

import { initialization } from './lib/middlewares/initialization-routines.js';
import { program } from 'commander';
import { mkdirp } from 'mkdirp';

/**
 * Command-line interface.
 */
program
  .name('lkc init')
  .description('An assistant to create a new Lakechain middleware.')
  .option('-t, --type <type>', 'The type of project (app, middleware).')
  .option('-n, --name <name>', 'The name of the project.')
  .option('-d, --description <description>', 'The description of the project.')
  .option('-o, --output <output>', 'A path on the filesystem in which the project will be created.', '.')
  .parse(process.argv);

/**
 * The program options.
 */
const opts = program.opts();

/**
 * The program chain.
 */
const chain = new Chain();

/**
 * The current directory.
 */
const __dir = new URL(path.dirname(import.meta.url)).pathname;

/**
 * Injecting the initialization routines into the `chain`.
 */
chain.use(initialization);

/**
 * Verify whether the output directory exists and is empty.
 */
chain.use(async (_1, _2, next) => {
  if (!fs.existsSync(opts.output)) {
    const response = await prompts({
      type: 'confirm',
      name: 'value',
      message: `'${opts.output}' does not exist. Do you want to create it?`
    });

    if (!response.value) {
      return (console.log('Aborting.'));
    }
    mkdirp.sync(opts.output);
  }
  if (fs.readdirSync(opts.output).length > 0) {
    return (console.log(
      `The directory '${opts.output}' is not empty. Use --output to specify an empty directory.`
    ));
  }
  next();
});

/**
 * Prompt the user for a project type.
 */
chain.use(async (_1, _2, next) => {
  if (!['app', 'middleware'].includes(opts.type)) {
    const response = await prompts({
      type: 'select',
      name: 'type',
      message: 'What type of project would you like to create?',
      choices: [
        { title: 'Application', value: 'app' },
        { title: 'New Middleware', value: 'middleware' }
      ]
    });
    opts.type = response.type;
  }
  next();
});

/**
 * Prompt the user for a project name.
 */
chain.use(async (_1, _2, next) => {
  if (!opts.name && opts.type === 'app') {
    const response = await prompts({
      type: 'text',
      name: 'name',
      initial: 'sample-pipeline',
      message: 'What is the name of your project?',
    });
    opts.name = response.name;
  }
  next();
});

/**
 * Prompt the user for a project description.
 */
chain.use(async (_1, _2, next) => {
  if (!opts.description && opts.type === 'app') {
    const response = await prompts({
      type: 'text',
      name: 'description',
      message: 'What is the description of your project?',
      validate: (description) => description.length < 1 ?
        'A project description is required.' : true
    });
    opts.description = response.description;
  }
  next();
});

/**
 * Copy the appropriate template to the output directory.
 */
chain.use(async (_1, _2, next) => {
  const source = path.join(__dir, 'lib', 'templates', opts.type, 'typescript');
  await fse.copy(source, opts.output);
  next();
});

/**
 * Patch the project with the name and description.
 */
chain.use(async (_1, _2, next) => {
  if (opts.type === 'app') {
    const packageJson = JSON.parse(fs.readFileSync(
      path.join(opts.output, 'package.json')
    ));

    // Patch the project file.
    packageJson.name = opts.name;
    packageJson.description = opts.description;

    // Write the updates,
    fs.writeFileSync(
      path.join(opts.output, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }
  next();
});

/**
 * Display results.
 */
chain.use(async (_1, _2) => {
  console.log();
  console.log(
    boxen(`Project created successfully!\nRun ${chalk.cyan('npm install')} to setup`, {
      padding: 1,
      borderColor: 'yellow',
      borderStyle: 'bold'
    })
  );
  if (opts.output !== '.') {
    console.log(`\n👉 ${chalk.bold(path.resolve(opts.output))}\n`);
  } else {
    console.log();
  }
});

/**
 * Error handler.
 */
chain.use((err, _1, _2, _3) => {
  console.error(err.message || err);
  process.exit(1);
});

// Triggering the `chain`.
chain.handle({}, {});
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

import Chain from 'middleware-chain-js';
import Table from 'cli-table3';
import { initialization } from './lib/middlewares/initialization-routines.js';
import { program } from 'commander';

/**
 * Command-line interface.
 */
program
  .name('lkc search')
  .description('Searches for middlewares in the official Lakechain store.')
  .requiredOption('-q, --query <query>', 'The search query.')
  .option('-r, --registry <registry>', 'The base URL of an alternative NPM registry.', 'https://registry.npmjs.org/')
  .option('-o, --output <output>', 'The output format of the list (table, json).', 'table')
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
 * The default scope.
 */
const scope = 'project-lakechain';

/**
 * Injecting the initialization routines into the `chain`.
 */
chain.use(initialization);

/**
 * Query the NPM registry for all packages under
 * the `project-lakechain` scope.
 */
chain.use(async (input, _, next) => {
  const res = await fetch(
    `${opts.registry}/-/v1/search?text=${scope} ${opts.query}&size=10`
  );
  input.list = await res.json()
  next();
});

/**
 * Empty result handler.
 */
chain.use((input, _, next) => {
  if (input.list.objects.length === 0) {
    return (console.log('No results found.'));
  }
  next();
});

/**
 * Table formatter.
 */
chain.use((input, _, next) => {
  const width = process.stdout.columns;
  const maxDescription = width - 45;

  if (opts.output !== 'table') {
    return next();
  }

  // Create a new table with 3 columns.
  const table = new Table({
    head: ['Name', 'Description', 'Version'],
    colWidths: [26, maxDescription, 8],
    rowHeights: [2]
  });

  // Build the table.
  input.list.objects.forEach((pkg) => {
    table.push([
      pkg.package.name.replace('/', '/\n'),
      pkg.package.description
        .match(new RegExp(`.{1,${maxDescription}}`, 'g')).join('\n'),
      pkg.package.version
    ]);
  });

  // Render the table.
  console.log(table.toString());
});

/**
 * JSON formatter.
 */
chain.use((input, _, next) => {
  if (opts.output !== 'json') {
    return next();
  }
  console.log(
    JSON.stringify(input.list.objects, null, 2)
  );
});

/**
 * Error handler.
 */
chain.use((err, _1, _2, _3) => {
  console.error(err);
  process.exit(1);
});

// Triggering the `chain`.
chain.handle({}, {});
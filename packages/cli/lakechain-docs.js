import open from 'open';
import { program } from 'commander';

/**
 * Command-line interface.
 */
program
  .name('lkc docs')
  .description('Opens the Project Lakechain documentation.')
  .parse(process.argv);

/**
 * The Project Lakechain documentation URL.
 */
const url = 'https://awslabs.github.io/project-lakechain/';

console.log(`Opening ${url}...`);
await open('https://awslabs.github.io/project-lakechain/');

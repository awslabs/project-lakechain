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

(async () => {
  try {
    await open('https://awslabs.github.io/project-lakechain/');
  } catch (error) {
    console.log(`Could not open local browser. Open ${url} in your browser manually.`);
  }
})();

import exists from 'command-exists';
import ora from 'ora';
import disk from 'diskusage';
import prettyBytes from 'pretty-bytes';
import chalk from 'chalk';

import { program } from 'commander';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

/**
 * The STS client.
 */
const client = new STSClient({
  maxAttempts: 3
});

/**
 * Command-line interface.
 */
program
  .name('lkc doctor')
  .description('Diagnoses the environment and suggests solutions.')
  .parse(process.argv);

(async () => {
  console.log(`
    Welcome to Lakechain Doctor!
    This utility checks compatibility with Lakechain.
  `);

  console.log(chalk.bold.underline('Mandatory Checks\n'));

  // Disk space.
  let spinner = ora('Checking disk space ...').start();
  try {
    const { free } = await disk.check('/');

    // If the available disk space is less than 10GB, we issue a warning.
    if (free < 10 * 1024 * 1024 * 1024) {
      spinner.warn(`Disk space available on / is ${prettyBytes(free)}.`);
    } else {
      spinner.succeed(`Disk space available on / is ${prettyBytes(free)}.`);
    }
  } catch (error) {
    spinner.fail('Could not check disk space.');
  }

  // Node.js.
  spinner = ora('Checking `node` ...').start();
  try {
    await exists('node');
    spinner.succeed('`node` is installed on this system.');
  } catch (error) {
    spinner.fail('`node` was not found on this system.');
  }

  // NPM.
  spinner = ora('Checking `npm` ...').start();
  try {
    await exists('npm');
    spinner.succeed('`npm` is installed on this system.');
  } catch (error) {
    spinner.fail('`npm` was not found on this system.');
  }

  // Pip or Pip3.
  spinner = ora('Checking `pip` ...').start();
  try {
    await exists('pip');
    spinner.succeed('`pip` is installed on this system.');
  } catch (error) {
    try {
      await exists('pip3');
      spinner.succeed('`pip3` is installed on this system.');
    } catch (error) {
      spinner.fail('`pip` or `pip3` was not found on this system.');
    }
  }
  
  // AWS Credentials.
  spinner = ora('Checking AWS credentials ...').start();
  try {
    const res = await client.send(new GetCallerIdentityCommand({}));
    spinner.succeed(`AWS credentials found for user ${res.UserId}.`);
  } catch (error) {
    spinner.fail('Could not find valid AWS credentials.');
  }

  // Docker.
  spinner = ora('Checking `docker` ...').start();
  try {
    await exists('docker');
    spinner.succeed('`docker` is installed on this system.');
  } catch (error) {
    spinner.fail('`docker` was not found on this system.');
  }

  console.log(chalk.bold.underline('\nOptional Checks\n'));

  // TypeScript.
  spinner = ora('Checking `tsc` ...').start();
  try {
    await exists('tsc');
    spinner.succeed('`tsc` is installed on this system.');
  } catch (error) {
    spinner.fail('`tsc` was not found on this system.');
  }

  // AWS CDK.
  spinner = ora('Checking `cdk` ...').start();
  try {
    await exists('cdk');
    spinner.succeed('`cdk` is installed on this system.');
  } catch (error) {
    spinner.fail('`cdk` was not found on this system.');
  }

  console.log();
})();

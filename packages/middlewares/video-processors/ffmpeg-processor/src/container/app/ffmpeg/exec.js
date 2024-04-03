import path from 'path';

import { spawn } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * References the current directory.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Spawns a new process executing the FFMPEG processing
 * with the user-provided function.
 * @param {*} events the input document events to process.
 * @param {*} opts the options to use.
 * @returns a promise that resolves when the process has
 * finished.
 */
export const exec = async (events, { cwd }) => {
  const child = spawn('node', [
    path.join(__dirname, 'process.js'),
    JSON.stringify(events)
  ], {
    env: process.env,
    cwd
  });

  child.stdout.on('data', (data) => console.log(data?.toString ? data.toString() : data));
  child.stderr.on('data', (data) => console.error(data?.toString ? data.toString() : data));

  // Wait for the process to exit.
  return new Promise((resolve, reject) => {
    child.on('close', (code) => code ? reject(code) : resolve());
    child.on('error', reject);
  });
};

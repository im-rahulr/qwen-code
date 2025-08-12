#!/usr/bin/env node

// Wrapper for the Codec CLI that suppresses Node.js deprecation warnings
// and then runs the bundled CLI entrypoint.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Apply --no-deprecation only once to avoid relaunch loops
const alreadyApplied = process.env.CODEC_NO_DEPRECATION_APPLIED === '1';
const hasNoDep = process.execArgv.includes('--no-deprecation') ||
  (process.env.NODE_OPTIONS || '').includes('--no-deprecation');
const hasNoWarnings = process.execArgv.includes('--no-warnings') ||
  (process.env.NODE_OPTIONS || '').includes('--no-warnings') ||
  process.env.NODE_NO_WARNINGS === '1';

if (!alreadyApplied || !hasNoDep || !hasNoWarnings) {
  const execArgv = Array.from(new Set([
    '--no-deprecation',
    '--no-warnings',
    ...process.execArgv,
  ]));
  const result = spawnSync(process.execPath, [...execArgv, ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, CODEC_NO_DEPRECATION_APPLIED: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(result.status ?? 0);
}

// As a belt-and-suspenders approach, swallow process 'warning' events so nothing is printed
process.on('warning', () => {});

// Resolve the bundled entry (bundle/gemini.js) relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bundlePath = path.resolve(__dirname, '..', 'bundle', 'gemini.js');

// Dynamically import the bundled CLI using a file:// URL (Windows-safe)
const { pathToFileURL } = await import('node:url');
await import(pathToFileURL(bundlePath).href);


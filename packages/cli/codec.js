#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Relaunch early with --no-deprecation to hide Node.js deprecation warnings
import { spawnSync } from 'node:child_process';

const hasNoDepFlag = process.execArgv.includes('--no-deprecation') ||
  (process.env.NODE_OPTIONS || '').includes('--no-deprecation');

if (!hasNoDepFlag && process.env.CODEC_NO_DEPRECATION_APPLIED !== '1') {
  const argv = Array.from(new Set(['--no-deprecation', ...process.execArgv]));
  const result = spawnSync(
    process.execPath,
    [...argv, ...process.argv.slice(1)],
    {
      stdio: 'inherit',
      env: { ...process.env, CODEC_NO_DEPRECATION_APPLIED: '1' },
    },
  );
  // Exit with the child's status to preserve exit codes
  process.exit(result.status ?? 0);
}

// Import and run the main CLI after flags are applied
import('./dist/index.js');

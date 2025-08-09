#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Set NODE_OPTIONS to suppress deprecation warnings
process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --no-deprecation';

// Import and run the main CLI
import('./dist/index.js');

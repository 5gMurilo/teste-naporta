#!/usr/bin/env node
/**
 * Container smoke tests: real image builds and real containers, never mocks. Usage:
 *   pnpm test:containers [api|web|stack|all]
 * Without Docker the command fails; a missing runtime is never reported as a pass.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname);
const suites = ['api', 'web', 'stack'];
const selection = process.argv[2] ?? 'all';

if (selection !== 'all' && !suites.includes(selection)) {
  console.error(`Unknown suite "${selection}". Use one of: ${suites.join(', ')}, all.`);
  process.exit(2);
}

const docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8' });
if (docker.status !== 0) {
  console.error('Docker is not available. Start Docker (or OrbStack) and run the command again.');
  process.exit(1);
}

const files = (selection === 'all' ? suites : [selection])
  .map((name) => resolve(root, `containers/${name}.test.mjs`))
  .filter((file) => existsSync(file));
if (files.length === 0) {
  console.error(`No container tests exist yet for "${selection}".`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-timeout=900000', ...files], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);

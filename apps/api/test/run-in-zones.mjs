#!/usr/bin/env node
/**
 * Runs the tests tagged [tz] once per time zone, each in its own Node process, because the zone of
 * a running Jest ESM sandbox cannot be switched. Usage: node test/run-in-zones.mjs <jest config>
 */
import { spawnSync } from 'node:child_process';

export const ZONES = ['America/Sao_Paulo', 'Pacific/Kiritimati'];

const [config, ...extra] = process.argv.slice(2);
if (!config) {
  console.error('Usage: node test/run-in-zones.mjs <jest config>');
  process.exit(2);
}

for (const zone of ZONES) {
  console.log(`\n==> [tz] tests with TZ=${zone}`);
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'jest',
      '--config',
      config,
      '--runInBand',
      '-t',
      '\\[tz\\]',
      ...extra.filter((a) => a !== '--runInBand'),
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, TZ: zone, NODE_OPTIONS: '--experimental-vm-modules' },
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

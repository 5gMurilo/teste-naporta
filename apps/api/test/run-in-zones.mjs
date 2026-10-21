#!/usr/bin/env node
/**
 * Runs the tests tagged [tz] once per time zone, each in its own Node process, because the zone of
 * a running Jest ESM sandbox cannot be switched. Usage: node test/run-in-zones.mjs <jest config>
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const ZONES = ['America/Sao_Paulo', 'Pacific/Kiritimati'];

const [config, ...extra] = process.argv.slice(2);
if (!config) {
  console.error('Usage: node test/run-in-zones.mjs <jest config>');
  process.exit(2);
}

for (const zone of ZONES) {
  console.log(`\n==> [tz] tests with TZ=${zone}`);
  const directory = mkdtempSync(join(tmpdir(), 'naporta-zones-'));
  const report = join(directory, 'report.json');
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
      '--json',
      `--outputFile=${report}`,
      ...extra.filter((a) => a !== '--runInBand'),
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, TZ: zone, NODE_OPTIONS: '--experimental-vm-modules' },
    },
  );
  let passed = 0;
  try {
    passed = JSON.parse(readFileSync(report, 'utf8')).numPassedTests;
  } catch {
    // reported below
  }
  rmSync(directory, { recursive: true, force: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (passed < 1) {
    // Jest exits 0 when -t matches nothing; a zone run that proves nothing must not look green.
    console.error(`No [tz] test ran in ${zone}.`);
    process.exit(1);
  }
}

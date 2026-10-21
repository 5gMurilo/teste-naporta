import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('../run-in-zones.mjs', import.meta.url), 'utf8');

describe('time zone runner', () => {
  it('runs the tz suites in UTC too', () => {
    const zones = source.match(/export const ZONES = \[([^\]]*)\]/)?.[1] ?? '';

    for (const zone of ['America/Sao_Paulo', 'Pacific/Kiritimati', 'UTC']) {
      assert.ok(zones.includes(`'${zone}'`), `ZONES must include ${zone}`);
    }
  });
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const rootScripts = read('package.json').scripts;
const apiScripts = read('apps/api/package.json').scripts;

describe('start script (PRD section 12)', () => {
  it('defines start in the root and the API package, without a watcher', () => {
    assert.equal(rootScripts.start, 'pnpm --filter @naporta/api start');
    assert.equal(apiScripts.start, 'pnpm build && node dist/main.js');
    assert.doesNotMatch(`${rootScripts.start} ${apiScripts.start}`, /watch/);
  });

  it('stops before the server when the build fails', () => {
    const [build, server] = apiScripts.start.split(' && ');
    assert.equal(build, 'pnpm build');
    assert.equal(server, 'node dist/main.js');

    const result = spawnSync('sh', ['-c', apiScripts.start.replace(build, 'false').replace(server, 'echo SERVER_STARTED')], {
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /SERVER_STARTED/);
  });
});

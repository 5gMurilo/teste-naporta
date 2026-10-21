import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const compose = read('docker-compose.yml');
const envExample = read('.env.example');
const readme = read('README.md');

/** The text of one top-level service of the Compose file (two-space indent under `services:`). */
function service(name) {
  const match = compose.match(new RegExp(`^  ${name}:\\n((?:    .*\\n|\\n)+)`, 'm'));
  assert.ok(match, `service ${name} must exist in docker-compose.yml`);
  return match[1];
}

describe('login rate limit configuration (C13, C14)', () => {
  it('documents the login rate limit variables and the 429 row', () => {
    for (const variable of ['LOGIN_RATE_LIMIT', 'LOGIN_RATE_TTL_SECONDS', 'TRUST_PROXY_HOPS']) {
      assert.match(envExample, new RegExp(`^# ${variable}=`, 'm'), `.env.example must define ${variable}`);
      assert.ok(readme.includes(variable), `README must document ${variable}`);
    }
    assert.match(readme, /\| [^|]*login[^|]* \| 429 \| `HTTP_ERROR` \|/i);
  });

  it('sets TRUST_PROXY_HOPS to 1 on the api service', () => {
    const api = service('api');
    assert.match(api, /^ {6}TRUST_PROXY_HOPS: "?1"?$/m);
    assert.match(api, /^ {6}LOGIN_RATE_LIMIT: \$\{LOGIN_RATE_LIMIT:-5\}$/m);
    assert.match(api, /^ {6}LOGIN_RATE_TTL_SECONDS: \$\{LOGIN_RATE_TTL_SECONDS:-60\}$/m);
  });

  it('raises the login rate limit in the disposable stacks', () => {
    for (const [file, pattern] of [
      ['apps/api/test/helpers/postgres-test-context.ts', /LOGIN_RATE_LIMIT = '(\d+)'/],
    ]) {
      const match = read(file).match(pattern);
      assert.ok(match, `${file} must set LOGIN_RATE_LIMIT`);
      assert.ok(Number(match[1]) >= 1000, `${file} must set LOGIN_RATE_LIMIT to at least 1000`);
    }
  });
});

describe('operation files (C25, C26, C27)', () => {
  it('declares a healthcheck on the postgres service', () => {
    const postgres = service('postgres');
    assert.match(postgres, /^ {4}healthcheck:$/m);
    for (const field of ['test', 'interval', 'retries']) {
      assert.match(postgres, new RegExp(`^ {6}${field}: `, 'm'), `postgres healthcheck must set ${field}`);
    }
  });

  it('keeps .env.example free of functional secrets', () => {
    const active = Object.fromEntries(
      envExample
        .split('\n')
        .filter((line) => line.trim() !== '' && !line.startsWith('#'))
        .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
    );

    assert.equal(active.JWT_SECRET, '');
    assert.equal(new URL(active.DATABASE_URL).password, 'postgres');
    assert.deepEqual(
      Object.keys(active).filter((name) => /SECRET|PASSWORD/.test(name)),
      ['JWT_SECRET'],
    );
    assert.match(envExample, /^# SEED_USER_PASSWORD=replace-with-a-non-empty-password$/m);
    assert.match(envExample, /^# POSTGRES_PASSWORD=/m);
  });

  it('ignores .env in git', () => {
    const result = spawnSync('git', ['check-ignore', '.env'], { cwd: root, encoding: 'utf8' });

    assert.equal(result.status, 0, 'git must ignore .env');
  });
});

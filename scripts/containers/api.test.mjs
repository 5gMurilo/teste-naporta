import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import {
  createSandbox,
  docker,
  dockerBuild,
  hostPort,
  repoRoot,
  waitForHealthy,
  waitForPostgres,
} from './docker.mjs';

const sandbox = createSandbox('naporta-api-test');
const runtimeImage = `${sandbox.id}-runtime`;
const migrateImage = `${sandbox.id}-migrate`;
const DB_URL = (host) => `postgresql://postgres:pw@${host}:5432/app`;
let network;
let postgres;

describe('API image (PACK-01, BOOT-01, OPS-04, OPS-05)', () => {
  before(async () => {
    sandbox.trackImage(runtimeImage);
    sandbox.trackImage(migrateImage);
    await dockerBuild(['-f', 'apps/api/Dockerfile', '--target', 'runtime', '-t', runtimeImage, '.']);
    await dockerBuild(['-f', 'apps/api/Dockerfile', '--target', 'migrate', '-t', migrateImage, '.']);
    network = await sandbox.network();
    postgres = sandbox.name('pg');
    await sandbox.run([
      '--name', postgres, '--network', network,
      '-e', 'POSTGRES_PASSWORD=pw', '-e', 'POSTGRES_DB=app',
      'postgres:17-alpine',
    ]);
    await waitForPostgres(postgres, 'app');
  });
  after(() => sandbox.cleanup());

  it('builds from the frozen lockfile with separate build and runtime stages', () => {
    const dockerfile = readFileSync(`${repoRoot}/apps/api/Dockerfile`, 'utf8');

    assert.match(dockerfile, /pnpm install --frozen-lockfile/);
    assert.match(dockerfile, /^FROM .* AS build$/m);
    assert.match(dockerfile, /^FROM .* AS runtime$/m);
    assert.match(dockerfile, /^FROM .* AS migrate$/m);
    assert.doesNotMatch(dockerfile, /^COPY .*\.env/m);
  });

  it('runs the API and the migration job as a non-root user', async () => {
    for (const image of [runtimeImage, migrateImage]) {
      const uid = await docker(['run', '--rm', '--entrypoint', 'id', image, '-u']);
      assert.notEqual(uid, '0', `${image} must not run as root`);
    }
    const configured = await docker(['inspect', '-f', '{{.Config.User}}', runtimeImage]);
    assert.equal(configured, 'node');
  });

  it('ships only the compiled app and production dependencies, with no secrets', async () => {
    const listing = (await docker(['run', '--rm', '--entrypoint', 'ls', runtimeImage, '-A', '/app'])).split('\n').sort();
    const binaries = await docker(['run', '--rm', '--entrypoint', 'sh', runtimeImage, '-c', 'ls /app/node_modules/.bin 2>/dev/null || true']);
    const envFiles = await docker(['run', '--rm', '--entrypoint', 'sh', runtimeImage, '-c', 'find / -name ".env*" -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null || true']);
    const config = await docker(['inspect', '-f', '{{json .Config.Env}}', runtimeImage]);
    const history = await docker(['history', '--no-trunc', '--format', '{{.CreatedBy}}', runtimeImage]);

    assert.deepEqual(listing, ['dist', 'node_modules', 'package.json']);
    assert.doesNotMatch(binaries, /\b(tsc|jest|prisma|biome|ts-node)\b/);
    assert.equal(envFiles.replace(/\s+/g, ''), '');
    assert.doesNotMatch(config, /JWT_SECRET|DATABASE_URL|PASSWORD|SEED_/);
    assert.doesNotMatch(history, /JWT_SECRET|SEED_USER_PASSWORD/);
  });

  it('applies the versioned migrations on an empty database, and a second run finds nothing pending', async () => {
    const run = () =>
      docker(['run', '--rm', '--network', network, '-e', `DATABASE_URL=${DB_URL(postgres)}`, migrateImage]);

    const first = await run();
    const tables = await docker(['exec', postgres, 'psql', '-U', 'postgres', '-d', 'app', '-tAc',
      `SELECT string_agg(table_name, ',' ORDER BY table_name) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Order','OrderItem','User')`]);
    const second = await run();

    assert.match(first, /successfully applied/);
    assert.equal(tables, 'Order,OrderItem,User');
    assert.match(second, /No pending migrations/i);
  });

  it('serves health and login from the compiled API against the real database, without seeding on start', async () => {
    const api = sandbox.name('api');
    await sandbox.run([
      '--name', api, '--network', network, '-p', '127.0.0.1::3000',
      '-e', `DATABASE_URL=${DB_URL(postgres)}`,
      '-e', 'REDIS_URL=redis://unreachable-redis:6379',
      '-e', 'JWT_SECRET=container-test-secret-0123456789abcdef',
      '-e', 'JWT_ISSUER=naporta', '-e', 'JWT_AUDIENCE=naporta-web', '-e', 'JWT_EXPIRES_IN=3600',
      '-e', 'NODE_ENV=production',
      runtimeImage,
    ]);
    await waitForHealthy(api);
    const base = `http://127.0.0.1:${await hostPort(api, 3000)}`;

    const health = await fetch(`${base}/api/v1/health`);
    const login = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.test', password: 'whatever' }),
    });
    const users = await docker(['exec', postgres, 'psql', '-U', 'postgres', '-d', 'app', '-tAc', 'SELECT count(*) FROM "User"']);
    const docs = await fetch(`${base}/docs-json`);

    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok', database: 'up' });
    assert.equal(login.status, 401);
    assert.equal((await login.json()).code, 'INVALID_CREDENTIALS');
    assert.equal(users, '0');
    assert.equal(docs.status, 200);
  });

  it('declares a health check that the running container passes', async () => {
    const check = await docker(['inspect', '-f', '{{json .Config.Healthcheck.Test}}', runtimeImage]);

    assert.match(check, /api\/v1\/health/);
  });

  it('refuses to start with an invalid configuration and prints no secret', async () => {
    const result = await docker(['run', '--rm', '--network', network,
      '-e', 'DATABASE_URL=not-a-url', '-e', 'JWT_SECRET=short-secret-value',
      runtimeImage]).then(() => ({ exited: false }), (error) => ({ exited: true, output: error.output }));

    assert.equal(result.exited, true);
    assert.match(result.output, /API startup failed/);
    assert.doesNotMatch(result.output, /short-secret-value|not-a-url/);
  });
});

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { promisify } from 'node:util';
import { docker, repoRoot, waitFor } from './docker.mjs';

const execFileAsync = promisify(execFile);
const project = `naporta-stack-${randomBytes(4).toString('hex')}`;
const secret = randomBytes(24).toString('hex');
const SEED = { email: 'demo@example.test', password: randomBytes(12).toString('hex') };
let env;
let web;
let api;

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

/** `docker compose -p <unique project> ...`: never touches the developer's own project or volumes. */
async function compose(args, extra = {}) {
  try {
    const { stdout } = await execFileAsync('docker', ['compose', '-p', project, ...args], {
      cwd: repoRoot,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env, ...extra },
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (error) {
    const failure = new Error(`docker compose ${args.join(' ')} failed:\n${error.stderr || error.message}`);
    failure.output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    throw failure;
  }
}

const psql = (sql) => compose(['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', 'teste_naporta', '-tAc', sql]);
const containerOf = async (service) => (await compose(['ps', '-a', '-q', service])).split('\n')[0];

async function login(base) {
  const response = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(SEED),
  });
  assert.equal(response.status, 200);
  return (await response.json()).accessToken;
}

const authed = (token) => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });
const orderBody = (orderNumber) => ({
  orderNumber,
  expectedDeliveryDate: '2026-11-03',
  customer: { name: 'Ana Silva', document: 'DOC-1' },
  deliveryAddress: { street: 'Rua das Flores', number: '101', neighborhood: 'Centro', city: 'São Paulo', state: 'SP', postalCode: '01001000' },
  items: [{ description: 'Café', priceCents: 4990 }],
});

describe('Compose stack (OPS-01, PACK-02, PACK-03, PACK-04, OPS-04)', () => {
  before(async () => {
    env = {
      JWT_SECRET: secret,
      POSTGRES_PORT: String(await freePort()),
      API_PORT: String(await freePort()),
      WEB_PORT: String(await freePort()),
      SEED_USER_EMAIL: SEED.email,
      SEED_USER_PASSWORD: SEED.password,
    };
    web = `http://127.0.0.1:${env.WEB_PORT}`;
    api = `http://127.0.0.1:${env.API_PORT}`;
    await compose(['up', '-d', '--build']);
    await waitFor(async () => (await fetch(`${web}/api/v1/health`)).status === 200, {
      label: 'stack ready through the web proxy',
      timeoutMs: 180_000,
    });
  });
  after(async () => {
    // Only this run's project: its own containers, network and volume.
    await compose(['--profile', 'tools', 'down', '-v', '--remove-orphans', '--rmi', 'local']).catch(() => undefined);
  });

  it('rejects an invalid or secret-less configuration with a message that names the variable', async () => {
    const failing = await compose(['run', '--rm', '--no-deps', '-e', 'JWT_SECRET=', 'api'], { JWT_SECRET: '' }).then(
      () => ({ ok: true }),
      (error) => ({ ok: false, output: error.output }),
    );

    assert.equal(failing.ok, false);
    assert.match(failing.output, /API startup failed: Invalid environment fields: JWT_SECRET/);
  });

  it('runs the migration job to completion before the API starts', async () => {
    const [migrate, apiContainer] = await Promise.all([containerOf('migrate'), containerOf('api')]);
    const inspect = async (id, format) => docker(['inspect', '-f', format, id]);

    assert.equal(await inspect(migrate, '{{.State.ExitCode}}'), '0');
    assert.equal(await inspect(migrate, '{{.State.Status}}'), 'exited');
    const finished = Date.parse(await inspect(migrate, '{{.State.FinishedAt}}'));
    const started = Date.parse(await inspect(apiContainer, '{{.State.StartedAt}}'));
    assert.ok(finished <= started, 'migrate must finish before the API starts');
    assert.equal(await psql(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Order','OrderItem','User')`), '3');
  });

  it('publishes only loopback ports and nothing at all for Redis', async () => {
    for (const [service, port] of [['postgres', 5432], ['api', 3000], ['web', 8080]]) {
      const id = await containerOf(service);
      const bindings = JSON.parse(await docker(['inspect', '-f', '{{json .NetworkSettings.Ports}}', id]));
      const hosts = (bindings[`${port}/tcp`] ?? []).map((binding) => binding.HostIp);
      assert.deepEqual(hosts.length > 0 && hosts.every((host) => host === '127.0.0.1'), true, `${service} must be bound to 127.0.0.1`);
    }
    const redis = await containerOf('redis');
    const ports = JSON.parse(await docker(['inspect', '-f', '{{json .NetworkSettings.Ports}}', redis]));
    assert.deepEqual(Object.values(ports).flat().filter(Boolean), []);
    const save = await compose(['exec', '-T', 'redis', 'redis-cli', 'config', 'get', 'save']);
    const aof = await compose(['exec', '-T', 'redis', 'redis-cli', 'config', 'get', 'appendonly']);
    assert.match(save, /^save\s*$/);
    assert.match(aof, /appendonly\s+no/);
  });

  it('starts without demo data: nothing is seeded automatically', async () => {
    assert.equal(await psql('SELECT count(*) FROM "User"'), '0');
    assert.equal(await psql('SELECT count(*) FROM "Order"'), '0');
  });

  it('seeds only on explicit request, then logs in and creates an order through the web proxy', async () => {
    await compose(['run', '--rm', 'seed'], {});
    assert.equal(await psql('SELECT count(*) FROM "User"'), '1');
    assert.equal(await psql('SELECT count(*) FROM "Order"'), '12');

    const token = await login(web);
    const created = await fetch(`${web}/api/v1/orders`, { method: 'POST', headers: authed(token), body: JSON.stringify(orderBody('NP-STACK')) });
    const body = await created.json();

    assert.equal(created.status, 201);
    assert.match(created.headers.get('location'), /^\/api\/v1\/orders\/[0-9a-f-]{36}$/);
    assert.ok(created.headers.get('x-request-id'));
    assert.equal((await (await fetch(`${web}/api/v1/orders/${body.id}`, { headers: authed(token) })).json()).orderNumber, 'NP-STACK');
  });

  it('reloads a deep visual route and keeps API errors as JSON, never as the SPA page', async () => {
    const route = await fetch(`${web}/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b/edit`);
    const apiError = await fetch(`${web}/api/v1/orders/00000000-0000-4000-8000-000000000000`, { headers: authed(await login(web)) });
    const unauthenticated = await fetch(`${web}/api/v1/orders`);

    assert.equal(route.status, 200);
    assert.match(await route.text(), /<div id="root">/);
    assert.equal(apiError.status, 404);
    assert.equal((await apiError.json()).code, 'ORDER_NOT_FOUND');
    assert.equal(unauthenticated.status, 401);
    assert.match(unauthenticated.headers.get('content-type'), /problem\+json/);
  });

  it('exposes the documentation on the API port and the health on both', async () => {
    assert.equal((await fetch(`${api}/docs-json`)).status, 200);
    assert.equal((await fetch(`${api}/api/v1/health`)).status, 200);
    assert.equal((await fetch(`${web}/api/v1/health`)).status, 200);
  });

  it('keeps working with the cache lost or Redis stopped, and caches again when it returns', async () => {
    const token = await login(web);
    const list = await (await fetch(`${web}/api/v1/orders?orderNumber=NP-STACK`, { headers: authed(token) })).json();
    const id = list.data[0].id;
    const read = () => fetch(`${web}/api/v1/orders/${id}`, { headers: authed(token) });
    const cached = async () => Number(await compose(['exec', '-T', 'redis', 'redis-cli', 'dbsize']));

    assert.equal((await read()).status, 200);
    await waitFor(async () => (await cached()) === 1, { label: 'cache entry' });

    await compose(['restart', 'redis']);
    await waitFor(async () => (await compose(['exec', '-T', 'redis', 'redis-cli', 'ping'])) === 'PONG', { label: 'redis back' });
    assert.equal(await cached(), 0, 'a restarted Redis has lost every entry');
    assert.equal((await read()).status, 200);

    await compose(['stop', 'redis']);
    const started = Date.now();
    const whileDown = await read();
    assert.equal(whileDown.status, 200);
    assert.ok(Date.now() - started < 3000, 'a stopped Redis must not stall requests');
    assert.equal((await fetch(`${web}/api/v1/health`)).status, 200);

    await compose(['start', 'redis']);
    await waitFor(async () => {
      await read();
      return (await cached()) === 1;
    }, { label: 'cache repopulated after Redis returned', timeoutMs: 60_000 });
  });

  it('keeps the PostgreSQL data across down and up without removing the volume', async () => {
    const before = await psql('SELECT count(*) FROM "Order"');
    const volume = (await docker(['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`])).split('\n').find((name) => name.endsWith('postgres_data'));
    assert.ok(volume, 'the project must own a postgres_data volume');

    await compose(['down']);
    assert.ok((await docker(['volume', 'ls', '-q'])).split('\n').includes(volume), 'down must keep the volume');
    await compose(['up', '-d']);
    await waitFor(async () => (await fetch(`${web}/api/v1/health`)).status === 200, { label: 'stack back after down/up', timeoutMs: 120_000 });

    assert.equal(await psql('SELECT count(*) FROM "Order"'), before);
    assert.equal(await psql(`SELECT count(*) FROM "Order" WHERE "orderNumber" = 'NP-STACK'`), '1');
    const token = await login(web);
    assert.equal((await fetch(`${web}/api/v1/orders?orderNumber=NP-STACK`, { headers: authed(token) })).status, 200);
  });
});

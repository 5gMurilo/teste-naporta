import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { after, before, describe, it } from 'node:test';
import { createSandbox, docker, dockerBuild, hostPort, waitForHealthy } from './docker.mjs';

const sandbox = createSandbox('naporta-web-test');
const image = `${sandbox.id}-web`;
let network;
let base;
let upstreamName;

// A minimal API stand-in. The real API behind the proxy is exercised by the stack tests.
const UPSTREAM = `
const http = require('node:http');
const problem = (status, code) => JSON.stringify({ type: 'about:blank', status, code, requestId: 'req-1' });
http.createServer((req, res) => {
  const send = (status, headers, body) => { res.writeHead(status, headers); res.end(body); };
  if (req.url === '/api/v1/ok') return send(200, { 'content-type': 'application/json', 'x-request-id': 'upstream-id-1' }, '{"ok":true}');
  if (req.url === '/api/v1/orders' && req.method === 'POST') return send(201, { 'content-type': 'application/json', location: '/api/v1/orders/123' }, '{"id":"123"}');
  if (req.url === '/api/v1/unavailable') return send(503, { 'content-type': 'application/problem+json' }, problem(503, 'SERVICE_UNAVAILABLE'));
  return send(404, { 'content-type': 'application/problem+json' }, problem(404, 'ORDER_NOT_FOUND'));
}).listen(3000);
`;

const get = (path, init) => fetch(`${base}${path}`, { redirect: 'manual', ...init });

describe('web image (PACK-01, PACK-03, WEB-01)', () => {
  before(async () => {
    sandbox.trackImage(image);
    await dockerBuild(['-f', 'apps/web/Dockerfile', '-t', image, '.']);
    network = await sandbox.network();
    upstreamName = sandbox.name('api');
    await sandbox.run(['--name', upstreamName, '--network', network, 'node:22.22.3-slim', 'node', '-e', UPSTREAM]);
    const web = sandbox.name('web');
    await sandbox.run([
      '--name', web, '--network', network, '-p', '127.0.0.1::8080',
      '-e', `API_UPSTREAM=http://${upstreamName}:3000`,
      image,
    ]);
    await waitForHealthy(web);
    base = `http://127.0.0.1:${await hostPort(web, 8080)}`;
  });
  after(() => sandbox.cleanup());

  it('runs as a non-root user and ships only the static bundle', async () => {
    const uid = await docker(['run', '--rm', '--entrypoint', 'id', image, '-u']);
    const files = await docker(['run', '--rm', '--entrypoint', 'sh', image, '-c', 'ls -A /usr/share/nginx/html; ls /usr/share/nginx/html/assets']);
    const envFiles = await docker(['run', '--rm', '--entrypoint', 'sh', image, '-c', 'find / -name ".env*" -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null || true']);

    assert.notEqual(uid, '0');
    assert.match(files, /index\.html/);
    assert.match(files, /\.js/);
    assert.doesNotMatch(files, /\.map|\.tsx?\b|node_modules|src/);
    assert.equal(envFiles.replace(/\s+/g, ''), '');
  });

  it('serves the index and the hashed assets with the right types and cache rules', async () => {
    const index = await get('/');
    const html = await index.text();
    const asset = html.match(/\/assets\/[^"']+\.js/)?.[0];
    const css = html.match(/\/assets\/[^"']+\.css/)?.[0];

    assert.equal(index.status, 200);
    assert.match(index.headers.get('content-type'), /text\/html/);
    assert.equal(index.headers.get('cache-control'), 'no-cache');
    assert.ok(asset && css, 'index.html must reference a script and a stylesheet');
    for (const [path, type] of [[asset, /javascript/], [css, /text\/css/]]) {
      const response = await get(path);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get('content-type'), type);
      assert.match(response.headers.get('cache-control'), /immutable/);
    }
  });

  it('serves the SPA for visual routes after a reload and never for missing files', async () => {
    for (const path of ['/orders', '/orders/6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b/edit', '/login']) {
      const response = await get(path);
      assert.equal(response.status, 200, path);
      assert.match(await response.text(), /<div id="root">/);
    }
    for (const path of ['/assets/missing.js', '/missing.png', '/favicon.ico']) {
      const response = await get(path);
      assert.equal(response.status, 404, path);
      assert.doesNotMatch(await response.text(), /<div id="root">/);
    }
  });

  it('forwards /api untouched: statuses, bodies, and headers such as Location and X-Request-Id', async () => {
    const ok = await get('/api/v1/ok');
    const created = await get('/api/v1/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const missing = await get('/api/v1/orders/unknown');
    const unavailable = await get('/api/v1/unavailable');

    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('x-request-id'), 'upstream-id-1');
    assert.deepEqual(await ok.json(), { ok: true });
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('location'), '/api/v1/orders/123');
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('content-type'), /application\/problem\+json/);
    assert.equal((await missing.json()).code, 'ORDER_NOT_FOUND');
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).code, 'SERVICE_UNAVAILABLE');
  });

  it('answers a machine-readable 502, not the SPA page, when the API cannot be reached', async () => {
    const web = sandbox.name('web-no-api');
    await sandbox.run([
      '--name', web, '--network', network, '-p', '127.0.0.1::8080',
      '-e', `API_UPSTREAM=http://${upstreamName}:9`,
      image,
    ]);
    await waitForHealthy(web);

    const response = await fetch(`http://127.0.0.1:${await hostPort(web, 8080)}/api/v1/ok`);

    assert.equal(response.status, 502);
    assert.match(response.headers.get('content-type'), /application\/problem\+json/);
    const body = await response.text();
    assert.doesNotMatch(body, /<html|<div id="root">/i);
    assert.equal(JSON.parse(body).status, 502);
  });

  it('sends security headers and keeps secrets and server details out of the bundle', async () => {
    const index = await get('/');
    const html = await index.text();
    const script = await (await get(html.match(/\/assets\/[^"']+\.js/)[0])).text();

    assert.equal(index.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(index.headers.get('x-frame-options'), 'DENY');
    assert.match(index.headers.get('content-security-policy'), /default-src 'self'/);
    assert.doesNotMatch(index.headers.get('server') ?? '', /\d/);
    assert.doesNotMatch(script, /JWT_SECRET|DATABASE_URL|REDIS_URL|SEED_USER_PASSWORD/);
  });

  it('loads in a real browser under the content security policy and shows the login page', async () => {
    const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
    const { chromium } = require('@playwright/test');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const problems = [];
      page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
      page.on('pageerror', (error) => problems.push(error.message));

      await page.goto(`${base}/orders`);
      await page.getByRole('heading', { name: 'Entrar' }).waitFor();

      assert.equal(new URL(page.url()).pathname, '/login');
      assert.deepEqual(problems, []);
    } finally {
      await browser.close();
    }
  });
});

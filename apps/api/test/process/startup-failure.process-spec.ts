import { execFileSync, spawn } from 'node:child_process';
import { connect, createServer } from 'node:net';
import { resolve } from 'node:path';
import { jest } from '@jest/globals';

jest.setTimeout(180_000);

const apiDirectory = resolve(import.meta.dirname, '../..');

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as { port: number };
  await new Promise((done) => server.close(done));
  return port;
}

const accepts = (port: number) =>
  new Promise<boolean>((done) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => done(false));
  });

describe('API process with an invalid configuration', () => {
  it('exits non-zero without listening when the configuration is invalid', async () => {
    execFileSync('pnpm', ['build'], { cwd: apiDirectory, stdio: 'inherit' });
    const port = await freePort();
    const child = spawn('node', ['dist/main.js'], {
      cwd: apiDirectory,
      env: { ...process.env, PORT: String(port), DATABASE_URL: 'not-a-url' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    const exit = new Promise<number | null>((done) => child.once('exit', done));

    let listened = false;
    const watcher = setInterval(() => {
      void accepts(port).then((open) => {
        listened ||= open;
      });
    }, 25);
    const code = await exit;
    clearInterval(watcher);

    expect(code).not.toBe(0);
    expect(listened).toBe(false);
    expect(await accepts(port)).toBe(false);
    expect(stderr).toContain('Invalid environment fields: DATABASE_URL');
    expect(stderr).not.toContain('not-a-url');
  });
});

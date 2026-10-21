import { type ChildProcess, execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { createPostgresTestContext } from '../../../../api/test/helpers/postgres-test-context';
import { createRedisTestContext } from '../../../../api/test/helpers/redis-test-context';
import type { Service, StackSteps } from './stack';

const run = promisify(execFile);
const webDirectory = resolve(import.meta.dirname, '../../..');
const apiDirectory = resolve(webDirectory, '../api');
const STOP_GRACE_MS = 5000;

/** Only what a child needs to run; nothing else from the developer's shell leaks into the stack. */
const baseEnv = () => ({ PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' });

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolvePort(port));
    });
  });
}

function spawnService(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
): Service & { exited: () => boolean; output: () => string } {
  const child: ChildProcess = spawn(command, args, {
    cwd,
    env: { ...baseEnv(), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let exited = false;
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on('data', (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-4000);
    });
  }
  child.once('exit', () => {
    exited = true;
  });
  return {
    exited: () => exited,
    output: () => output,
    stop: () =>
      new Promise<void>((done) => {
        if (exited) return done();
        const timer = setTimeout(() => child.kill('SIGKILL'), STOP_GRACE_MS);
        child.once('exit', () => {
          clearTimeout(timer);
          done();
        });
        child.kill('SIGTERM');
      }),
  };
}

const services = new Map<Service, ReturnType<typeof spawnService>>();

export const defaultSteps: StackSteps = {
  freePort,
  secret: () => randomBytes(24).toString('hex'),

  async startPostgres() {
    const context = await createPostgresTestContext();
    return { databaseUrl: context.databaseUrl, stop: () => context.close() };
  },

  async startRedis() {
    const context = await createRedisTestContext();
    return { redisUrl: context.redisUrl, stop: () => context.close() };
  },

  async migrateAndSeed({ databaseUrl, seed }) {
    // createPostgresTestContext already applied the migrations; only the demo data is missing.
    await run('pnpm', ['exec', 'prisma', 'db', 'seed'], {
      cwd: apiDirectory,
      env: {
        ...baseEnv(),
        DATABASE_URL: databaseUrl,
        SEED_USER_EMAIL: seed.email,
        SEED_USER_PASSWORD: seed.password,
      },
    });
  },

  async startApi({ env }) {
    const entry = resolve(apiDirectory, 'dist/main.js');
    if (!existsSync(entry)) throw new Error('API build not found: run "pnpm build" first');
    const service = spawnService('node', [entry], apiDirectory, env);
    services.set(service, service);
    return service;
  },

  async startWeb({ port, apiUrl }) {
    if (!existsSync(resolve(webDirectory, 'dist/index.html'))) {
      throw new Error('Web build not found: run "pnpm build" first');
    }
    const service = spawnService(
      'pnpm',
      ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
      webDirectory,
      { DEV_PROXY_TARGET: apiUrl },
    );
    services.set(service, service);
    return service;
  },

  async waitForHttp(url, label) {
    const deadline = Date.now() + 40_000;
    let lastError = 'no response';
    while (Date.now() < deadline) {
      for (const service of services.values()) {
        if (service.exited())
          throw new Error(`${label} stack process exited early:\n${service.output()}`);
      }
      try {
        const response = await fetch(url);
        if (response.ok) return;
        lastError = `HTTP ${response.status}`;
      } catch (error) {
        lastError = (error as Error).message;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`${label} did not become ready at ${url} (${lastError})`);
  },
};

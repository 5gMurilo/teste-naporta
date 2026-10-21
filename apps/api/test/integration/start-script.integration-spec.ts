import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { jest } from '@jest/globals';
import { waitForPort } from '../helpers/wait-for-port.js';

jest.setTimeout(180_000);

const repository = resolve(import.meta.dirname, '../../../..');

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as { port: number };
  await new Promise((done) => server.close(done));
  return port;
}

function groupCommands(groupId: number): string[] {
  const pids = execFileSync('pgrep', ['-g', String(groupId)], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  return execFileSync('ps', ['-o', 'command=', '-p', pids.join(',')], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

describe('pnpm start', () => {
  let child: ChildProcess | undefined;
  afterAll(() => {
    if (child?.pid) process.kill(-child.pid, 'SIGTERM');
  });

  it('serves the health endpoint from the compiled output with pnpm start', async () => {
    const port = await freePort();
    child = spawn('pnpm', ['start'], {
      cwd: repository,
      detached: true,
      stdio: 'inherit',
      env: { ...process.env, PORT: String(port) },
    });
    const pid = child.pid as number;

    await waitForPort(`http://127.0.0.1:${port}`, { timeoutMs: 150_000 });
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', database: 'up' });
    const commands = groupCommands(pid);
    expect(commands.some((command) => command.includes('dist/main.js'))).toBe(true);
    expect(commands.filter((command) => command.includes('--watch'))).toEqual([]);
  });
});

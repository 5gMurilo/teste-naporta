import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export const repoRoot = resolve(import.meta.dirname, '../..');

/** Runs `docker <args>` and returns trimmed stdout; rejects with stderr on a non-zero exit. */
export async function docker(args, options = {}) {
  try {
    const { stdout } = await execFileAsync('docker', args, { maxBuffer: 64 * 1024 * 1024, ...options });
    return stdout.trim();
  } catch (error) {
    const failure = new Error(`docker ${args.join(' ')} failed:\n${error.stderr || error.message}`);
    // What the command itself printed, without the arguments (which may hold test credentials).
    failure.output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    throw failure;
  }
}

/** Streams a long `docker build` to the console and fails on a non-zero exit. */
export function dockerBuild(args) {
  return new Promise((done, fail) => {
    const child = spawn('docker', ['build', ...args], { cwd: repoRoot, stdio: ['ignore', 'inherit', 'inherit'] });
    child.once('exit', (code) => (code === 0 ? done() : fail(new Error(`docker build exited with ${code}`))));
    child.once('error', fail);
  });
}

/** Collects what a test creates so it is always removed, even when an assertion fails. */
export function createSandbox(prefix) {
  const id = `${prefix}-${randomBytes(4).toString('hex')}`;
  const containers = [];
  const networks = [];
  const volumes = [];
  const images = [];
  return {
    id,
    name: (suffix) => `${id}-${suffix}`,
    async network() {
      const name = `${id}-net`;
      await docker(['network', 'create', name]);
      networks.push(name);
      return name;
    },
    async run(args) {
      const containerId = await docker(['run', '-d', ...args]);
      containers.push(containerId);
      return containerId;
    },
    trackContainer: (name) => containers.push(name),
    trackVolume: (name) => volumes.push(name),
    trackImage: (tag) => images.push(tag),
    async cleanup() {
      for (const name of containers.reverse()) await docker(['rm', '-f', name]).catch(() => undefined);
      for (const name of volumes) await docker(['volume', 'rm', '-f', name]).catch(() => undefined);
      for (const name of networks) await docker(['network', 'rm', name]).catch(() => undefined);
      for (const tag of images) await docker(['image', 'rm', '-f', tag]).catch(() => undefined);
    },
  };
}

export async function waitFor(check, { timeoutMs = 60_000, intervalMs = 500, label = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${label}${last ? `: ${last.message}` : ''}`);
}

export const hostPort = async (container, containerPort) => {
  const mapping = await docker(['port', container, `${containerPort}/tcp`]);
  return mapping.split('\n')[0].split(':').pop();
};

export const waitForPostgres = (container, database) =>
  waitFor(
    async () => {
      await docker(['exec', container, 'pg_isready', '-U', 'postgres', '-d', database]);
      return true;
    },
    { label: 'PostgreSQL' },
  );

export const waitForHealthy = (container) =>
  waitFor(async () => (await docker(['inspect', '-f', '{{.State.Health.Status}}', container])) === 'healthy', {
    label: `${container} healthy`,
    timeoutMs: 90_000,
  });

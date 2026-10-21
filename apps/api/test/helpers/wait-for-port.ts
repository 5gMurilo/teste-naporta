import { connect } from 'node:net';

function tryConnect(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/**
 * Container runtimes can report a service ready a moment before the published host port accepts
 * connections. Probing the port from the host removes that race instead of retrying whole suites.
 */
export async function waitForPort(
  url: string,
  { timeoutMs = 20_000, intervalMs = 100 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const { hostname, port } = new URL(url);
  const deadline = Date.now() + timeoutMs;
  while (!(await tryConnect(hostname, Number(port), 500))) {
    if (Date.now() > deadline) throw new Error(`Port ${port} did not accept connections in time`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

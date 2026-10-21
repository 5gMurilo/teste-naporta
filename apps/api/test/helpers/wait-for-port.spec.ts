import { createServer } from 'node:net';
import { waitForPort } from './wait-for-port.js';

describe('waitForPort', () => {
  it('resolves once a server starts listening after the first attempts were refused', async () => {
    const probe = createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const { port } = probe.address() as { port: number };
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    const server = createServer();
    const waiting = waitForPort(`redis://127.0.0.1:${port}`, { intervalMs: 20 });
    await new Promise((resolve) => setTimeout(resolve, 120));
    await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));

    await expect(waiting).resolves.toBeUndefined();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('fails with a clear message when nothing ever listens', async () => {
    await expect(
      waitForPort('postgresql://127.0.0.1:1/db', { timeoutMs: 150, intervalMs: 20 }),
    ).rejects.toThrow('did not accept connections');
  });
});

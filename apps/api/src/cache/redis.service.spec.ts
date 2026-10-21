import { jest } from '@jest/globals';
import {
  type RedisClientLike,
  RedisService,
  RedisTimeoutError,
  RedisUnavailableError,
} from './redis.service.js';

const config = { CACHE_TIMEOUT_MS: 50 };

function createFakeClient(overrides: Partial<RedisClientLike> = {}) {
  const listeners: ((error: Error) => void)[] = [];
  const client = {
    isReady: true,
    on: jest.fn((_event: 'error', listener: (error: Error) => void) => {
      listeners.push(listener);
    }),
    connect: jest.fn(async () => undefined),
    get: jest.fn(async (_key: string) => 'value' as string | null),
    set: jest.fn(async (_key: string, _value: string, _options: { EX: number }) => 'OK'),
    del: jest.fn(async (_key: string) => 1),
    destroy: jest.fn(),
    ...overrides,
  };
  const emitError = (error: Error) => {
    for (const listener of listeners) listener(error);
  };
  return { client, emitError };
}

describe('RedisService (U02, U25)', () => {
  it('installs an error listener at construction and records only the error name', () => {
    const { client, emitError } = createFakeClient();
    const service = new RedisService(client, config);

    emitError(
      Object.assign(new Error('connect ECONNREFUSED redis://user:secret@host'), {
        name: 'ConnectionTimeoutError',
      }),
    );

    expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(service.errorCount).toBe(1);
    expect(service.lastError).toBe('ConnectionTimeoutError');
    expect(JSON.stringify([service.lastError])).not.toContain('secret');
  });

  it('connects in the background without blocking startup and absorbs a failed connection', async () => {
    const { client } = createFakeClient({
      connect: jest.fn(async () => Promise.reject(new Error('no redis'))),
    });
    const service = new RedisService(client, config);

    expect(service.onModuleInit()).toBeUndefined();
    await new Promise((resolve) => setImmediate(resolve));

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(service.errorCount).toBe(1);
  });

  it('delegates get, set with an expiry in seconds, and del when the client is ready', async () => {
    const { client } = createFakeClient();
    const service = new RedisService(client, config);

    await expect(service.get('k')).resolves.toBe('value');
    await service.set('k', 'v', 60);
    await service.del('k');

    expect(client.get).toHaveBeenCalledWith('k');
    expect(client.set).toHaveBeenCalledWith('k', 'v', { EX: 60 });
    expect(client.del).toHaveBeenCalledWith('k');
  });

  it('fails fast without touching the client while it is not ready', async () => {
    const { client } = createFakeClient({ isReady: false });
    const service = new RedisService(client, config);

    for (const operation of [
      () => service.get('k'),
      () => service.set('k', 'v', 60),
      () => service.del('k'),
    ]) {
      await expect(operation()).rejects.toBeInstanceOf(RedisUnavailableError);
    }
    expect(client.get).not.toHaveBeenCalled();
    expect(client.set).not.toHaveBeenCalled();
    expect(client.del).not.toHaveBeenCalled();
  });

  it('propagates command failures to the caller and destroys the client on shutdown', async () => {
    const failure = new Error('timeout');
    const { client } = createFakeClient({ get: jest.fn(async () => Promise.reject(failure)) });
    const service = new RedisService(client, config);

    await expect(service.get('k')).rejects.toBe(failure);
    service.onModuleDestroy();

    expect(client.destroy).toHaveBeenCalledTimes(1);
  });

  it('rejects an operation that outlives the deadline and ignores its late result', async () => {
    let settle: (value: string | null) => void = () => undefined;
    const { client } = createFakeClient({
      get: jest.fn(
        (_key: string) =>
          new Promise<string | null>((resolve) => {
            settle = resolve;
          }),
      ),
    });
    const service = new RedisService(client, config);
    const started = Date.now();

    await expect(service.get('k')).rejects.toBeInstanceOf(RedisTimeoutError);

    expect(Date.now() - started).toBeLessThan(500);
    settle('late');
  });

  it('does not leave an unhandled rejection when the abandoned command later fails', async () => {
    let fail: (error: Error) => void = () => undefined;
    const { client } = createFakeClient({
      get: jest.fn(
        (_key: string) =>
          new Promise<string | null>((_, reject) => {
            fail = reject;
          }),
      ),
    });
    const unhandled = jest.fn();
    process.once('unhandledRejection', unhandled);
    const service = new RedisService(client, config);

    await expect(service.get('k')).rejects.toBeInstanceOf(RedisTimeoutError);
    fail(new Error('connection reset'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
  });
});

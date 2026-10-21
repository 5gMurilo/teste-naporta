import { createServer, type Socket } from 'node:net';
import { jest } from '@jest/globals';
import { createClient } from 'redis';
import { createRedisClient } from '../../src/cache/redis.module.js';
import {
  RedisService,
  RedisTimeoutError,
  RedisUnavailableError,
} from '../../src/cache/redis.service.js';
import { loadApiConfig } from '../../src/config/env.js';
import { createRedisTestContext, type RedisTestContext } from '../helpers/redis-test-context.js';

jest.setTimeout(120_000);

const configFor = (redisUrl: string, timeoutMs = '200') =>
  loadApiConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost/db',
    JWT_SECRET: 'r'.repeat(32),
    JWT_ISSUER: 'naporta',
    JWT_AUDIENCE: 'naporta-web',
    JWT_EXPIRES_IN: '3600',
    REDIS_URL: redisUrl,
    CACHE_TIMEOUT_MS: timeoutMs,
  });

async function untilReady(service: RedisService, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!service.isReady) {
    if (Date.now() > deadline) throw new Error('Redis never became ready');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('Redis client against a disposable instance', () => {
  let context: RedisTestContext;
  const services: RedisService[] = [];

  const connect = async (redisUrl: string, timeoutMs = '200') => {
    const service = new RedisService(
      createRedisClient(configFor(redisUrl, timeoutMs)),
      configFor(redisUrl, timeoutMs),
    );
    services.push(service);
    service.onModuleInit();
    return service;
  };

  beforeAll(async () => {
    context = await createRedisTestContext();
  });
  afterEach(async () => {
    while (services.length > 0) services.pop()?.onModuleDestroy();
    await context.reset();
  });
  afterAll(async () => context.close());

  it('connects in the background and performs get, set with TTL, and del (I27)', async () => {
    const service = await connect(context.redisUrl);
    await untilReady(service);

    await service.set('naporta:v1:test:a', 'one', 30);
    expect(await service.get('naporta:v1:test:a')).toBe('one');
    const raw = createClient({ url: context.redisUrl });
    await raw.connect();
    const ttl = await raw.ttl('naporta:v1:test:a');
    raw.destroy();
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(30);

    await service.del('naporta:v1:test:a');
    expect(await service.get('naporta:v1:test:a')).toBeNull();
  });

  it('starts empty for every test because the namespace is reset between cases (I32)', async () => {
    const service = await connect(context.redisUrl);
    await untilReady(service);

    expect(await service.get('naporta:v1:test:a')).toBeNull();
  });

  it('fails immediately, without queueing, when Redis is unreachable (I27)', async () => {
    const service = await connect('redis://127.0.0.1:1');
    const started = Date.now();

    await expect(service.get('naporta:v1:x')).rejects.toBeInstanceOf(RedisUnavailableError);
    await expect(service.set('naporta:v1:x', 'v', 60)).rejects.toBeInstanceOf(
      RedisUnavailableError,
    );

    expect(Date.now() - started).toBeLessThan(100);
    expect(service.isReady).toBe(false);
  });

  it('rejects a command within the deadline when a ready connection stops answering (U25)', async () => {
    // Minimal RESP server: acknowledges the client handshake but never answers GET.
    const sockets: Socket[] = [];
    const stalled = createServer((socket) => {
      sockets.push(socket);
      socket.on('error', () => undefined);
      socket.on('data', (chunk) => {
        for (const match of chunk.toString().matchAll(/\*\d+\r\n\$\d+\r\n([A-Za-z]+)\r\n/g)) {
          if (match[1]?.toUpperCase() !== 'GET') socket.write('+OK\r\n');
        }
      });
    });
    await new Promise<void>((resolve) => stalled.listen(0, '127.0.0.1', resolve));
    const { port } = stalled.address() as { port: number };
    const service = await connect(`redis://127.0.0.1:${port}`, '150');
    try {
      await untilReady(service);
      const started = Date.now();

      await expect(service.get('naporta:v1:x')).rejects.toBeInstanceOf(RedisTimeoutError);

      expect(Date.now() - started).toBeLessThan(1000);
    } finally {
      service.onModuleDestroy();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => stalled.close(() => resolve()));
    }
  });

  it('gives up on a server that accepts the connection but never answers (U25)', async () => {
    const silent = createServer((socket) => socket.on('error', () => undefined));
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
    const { port } = silent.address() as { port: number };
    const service = await connect(`redis://127.0.0.1:${port}`, '100');
    try {
      const started = Date.now();

      await expect(service.get('naporta:v1:x')).rejects.toBeInstanceOf(RedisUnavailableError);

      expect(Date.now() - started).toBeLessThan(100);
    } finally {
      service.onModuleDestroy();
      await new Promise<void>((resolve) => silent.close(() => resolve()));
    }
  });

  it('closes the connection on destroy so nothing keeps reconnecting', async () => {
    const service = await connect(context.redisUrl);
    await untilReady(service);

    service.onModuleDestroy();

    expect(service.isReady).toBe(false);
  });
});

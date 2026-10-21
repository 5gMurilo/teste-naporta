import { jest } from '@jest/globals';
import { createClient } from 'redis';
import { createRedisClient } from '../../src/cache/cache.module.js';
import { cacheKey, OrdersDetailCache } from '../../src/cache/orders-detail.cache.js';
import { RedisService } from '../../src/cache/redis.service.js';
import { loadApiConfig } from '../../src/config/env.js';
import type { OrderResponse } from '../../src/orders/dto/order.responses.js';
import { createRedisTestContext, type RedisTestContext } from '../helpers/redis-test-context.js';

jest.setTimeout(120_000);

const ID = '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b';
const order: OrderResponse = {
  id: ID,
  orderNumber: 'NP-1',
  status: 'SHIPPED',
  expectedDeliveryDate: '2026-11-03',
  customer: { name: 'Ana Silva', document: 'DOC-1' },
  deliveryAddress: {
    street: 'Rua das Flores',
    number: '101',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01001000',
  },
  items: [{ id: '1b4e28ba-2fa1-4d3b-a3fd-27d4f4b9d0a1', description: 'Café', priceCents: 4990 }],
  totalCents: 4990,
  createdAt: '2026-10-21T12:30:45.123Z',
  updatedAt: '2026-10-21T12:30:45.123Z',
};

describe('OrdersDetailCache against Redis', () => {
  let context: RedisTestContext;
  let raw: ReturnType<typeof createClient>;
  const services: RedisService[] = [];

  const build = async (ttlSeconds = '60') => {
    const config = loadApiConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost/db',
      JWT_SECRET: 'r'.repeat(32),
      JWT_ISSUER: 'naporta',
      JWT_AUDIENCE: 'naporta-web',
      JWT_EXPIRES_IN: '3600',
      REDIS_URL: context.redisUrl,
      CACHE_TTL_SECONDS: ttlSeconds,
    });
    const redis = new RedisService(createRedisClient(config), config);
    services.push(redis);
    redis.onModuleInit();
    const deadline = Date.now() + 10_000;
    while (!redis.isReady) {
      if (Date.now() > deadline) throw new Error('Redis never became ready');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return new OrdersDetailCache(redis, config);
  };

  beforeAll(async () => {
    context = await createRedisTestContext();
    raw = createClient({ url: context.redisUrl });
    await raw.connect();
  });
  afterEach(async () => {
    while (services.length > 0) services.pop()?.onModuleDestroy();
    await context.reset();
  });
  afterAll(async () => {
    raw.destroy();
    await context.close();
  });

  it('writes the entry with a finite TTL and reads it back on the matching revision (I23, I24)', async () => {
    const cache = await build('60');

    await cache.put(ID, 4, order);

    const ttl = await raw.ttl(cacheKey(ID));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
    expect(await cache.get(ID, 4)).toEqual(order);
    expect(await cache.get(ID, 5)).toBeNull();
    expect(cache.stats).toEqual({ hits: 1, misses: 1, errors: 0 });
  });

  it('expires the entry after a short TTL and reports a miss afterwards (I24)', async () => {
    const cache = await build('1');
    await cache.put(ID, 1, order);

    const deadline = Date.now() + 5000;
    while ((await raw.exists(cacheKey(ID))) === 1 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    expect(await raw.exists(cacheKey(ID))).toBe(0);
    expect(await cache.get(ID, 1)).toBeNull();
  });

  it('treats a corrupted entry as an error plus a miss and lets invalidation remove it (I30)', async () => {
    const cache = await build();
    await raw.set(cacheKey(ID), '{"revision":1,"data":{"id":"x"}}');

    expect(await cache.get(ID, 1)).toBeNull();
    expect(cache.stats).toEqual({ hits: 0, misses: 0, errors: 1 });
    await cache.invalidate(ID);

    expect(await raw.exists(cacheKey(ID))).toBe(0);
  });

  it('keeps entries under the application namespace only', async () => {
    const cache = await build();
    await cache.put(ID, 1, order);

    const keys = await raw.keys('*');

    expect(keys).toEqual([cacheKey(ID)]);
  });
});

import { jest } from '@jest/globals';
import type { OrderResponse } from '../orders/dto/order.responses.js';
import { cacheKey, OrdersDetailCache } from './orders-detail.cache.js';
import type { RedisService } from './redis.service.js';

const ID = '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b';
const order = (id = ID): OrderResponse => ({
  id,
  orderNumber: 'NP-1',
  status: 'PENDING',
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
});

function setup(ttl = 60) {
  const store = new Map<string, { value: string; ttl: number }>();
  const redis = {
    get: jest.fn(async (key: string) => store.get(key)?.value ?? null),
    set: jest.fn(async (key: string, value: string, ttlSeconds: number) => {
      store.set(key, { value, ttl: ttlSeconds });
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
  const cache = new OrdersDetailCache(redis as unknown as RedisService, { CACHE_TTL_SECONDS: ttl });
  return { cache, redis, store };
}

describe('OrdersDetailCache (U24, U28)', () => {
  it('stores the versioned envelope under the namespaced key with the default TTL and reads it back', async () => {
    const { cache, redis, store } = setup();

    await cache.put(ID, 3, order());

    expect(cacheKey(ID)).toBe(`naporta:v1:orders:${ID}:detail`);
    expect(redis.set).toHaveBeenCalledWith(cacheKey(ID), expect.any(String), 60);
    expect(JSON.parse(store.get(cacheKey(ID))?.value ?? '')).toEqual({
      revision: 3,
      data: order(),
    });
    await expect(cache.get(ID, 3)).resolves.toEqual(order());
    expect(cache.stats).toEqual({ hits: 1, misses: 0, errors: 0 });
  });

  it('uses the configured TTL', async () => {
    const { cache, redis } = setup(5);

    await cache.put(ID, 1, order());

    expect(redis.set).toHaveBeenCalledWith(cacheKey(ID), expect.any(String), 5);
  });

  it('counts an absent key as a miss', async () => {
    const { cache } = setup();

    await expect(cache.get(ID, 1)).resolves.toBeNull();

    expect(cache.stats).toEqual({ hits: 0, misses: 1, errors: 0 });
  });

  it('treats an entry from another revision as a miss', async () => {
    const { cache } = setup();
    await cache.put(ID, 2, order());

    await expect(cache.get(ID, 3)).resolves.toBeNull();

    expect(cache.stats).toEqual({ hits: 0, misses: 1, errors: 0 });
  });

  it.each([
    ['broken JSON', '{not json'],
    ['non object', '"text"'],
    ['missing revision', JSON.stringify({ data: order() })],
    ['zero revision', JSON.stringify({ revision: 0, data: order() })],
    ['fractional revision', JSON.stringify({ revision: 1.5, data: order() })],
    ['extra envelope field', JSON.stringify({ revision: 1, data: order(), extra: true })],
    [
      'private field in data',
      JSON.stringify({ revision: 1, data: { ...order(), cacheRevision: 1 } }),
    ],
    ['deletedAt in data', JSON.stringify({ revision: 1, data: { ...order(), deletedAt: null } })],
    ['wrong shape', JSON.stringify({ revision: 1, data: { id: ID } })],
    [
      'another order id',
      JSON.stringify({ revision: 1, data: order('7d1c2d43-9c5e-4a54-9d2c-1e5d05ae8b7c') }),
    ],
  ])(
    'rejects %s as an invalid payload, counting an error and returning a miss (U25)',
    async (_name, raw) => {
      const { cache, store } = setup();
      store.set(cacheKey(ID), { value: raw, ttl: 60 });

      await expect(cache.get(ID, 1)).resolves.toBeNull();

      expect(cache.stats).toEqual({ hits: 0, misses: 0, errors: 1 });
    },
  );

  it('absorbs Redis failures on every operation without throwing (U25)', async () => {
    const { cache, redis } = setup();
    const failure = () => Promise.reject(new Error('redis://user:secret@host exploded'));
    redis.get.mockImplementation(failure);
    redis.set.mockImplementation(failure);
    redis.del.mockImplementation(failure);

    await expect(cache.get(ID, 1)).resolves.toBeNull();
    await expect(cache.put(ID, 1, order())).resolves.toBeUndefined();
    await expect(cache.invalidate(ID)).resolves.toBeUndefined();

    expect(cache.stats).toEqual({ hits: 0, misses: 0, errors: 3 });
  });

  it('invalidates by deleting only the order key', async () => {
    const { cache, redis, store } = setup();
    await cache.put(ID, 1, order());

    await cache.invalidate(ID);

    expect(redis.del).toHaveBeenCalledWith(cacheKey(ID));
    expect(store.size).toBe(0);
  });

  it('exposes counters as plain numbers with no payload, key, or identifier', async () => {
    const { cache } = setup();
    await cache.put(ID, 1, order());
    await cache.get(ID, 1);

    const serialized = JSON.stringify(cache.stats);

    expect(serialized).toBe('{"hits":1,"misses":0,"errors":0}');
    expect(serialized).not.toContain(ID);
    expect(serialized).not.toContain('Ana');
  });
});

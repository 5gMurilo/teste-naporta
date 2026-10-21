import { jest } from '@jest/globals';
import { createClient } from 'redis';
import request from 'supertest';
import { cacheKey, OrdersDetailCache } from '../../src/cache/orders-detail.cache.js';
import { OrdersRepository } from '../../src/orders/orders.repository.js';
import {
  createIntegrationApp,
  type IntegrationApp,
  validOrderBody,
} from '../helpers/integration-app.js';
import { createRedisTestContext, type RedisTestContext } from '../helpers/redis-test-context.js';

jest.setTimeout(180_000);

describe('GET /api/v1/orders/:id with PostgreSQL and Redis', () => {
  let redisContext: RedisTestContext;
  let env: IntegrationApp;
  let auth: string;
  let raw: ReturnType<typeof createClient>;
  let cache: OrdersDetailCache;

  beforeAll(async () => {
    redisContext = await createRedisTestContext();
    env = await createIntegrationApp({ waitForRedis: true });
    auth = await env.bearer();
    cache = env.app.get(OrdersDetailCache);
    raw = createClient({ url: redisContext.redisUrl });
    await raw.connect();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await redisContext.reset();
  });
  afterAll(async () => {
    raw.destroy();
    await env.app.close();
    await redisContext.close();
  });

  const http = () => request(env.app.getHttpServer());
  const get = (id: string) => http().get(`/api/v1/orders/${id}`).set('Authorization', auth);
  const patch = (id: string, body: object) =>
    http().patch(`/api/v1/orders/${id}`).set('Authorization', auth).send(body);
  const create = async (override: Record<string, unknown> = {}) =>
    (
      await http()
        .post('/api/v1/orders')
        .set('Authorization', auth)
        .send({ ...validOrderBody(), ...override })
        .expect(201)
    ).body;

  it('fills the cache on a miss and serves the identical body from it on a hit without loading items (I23)', async () => {
    const created = await create();
    const snapshotReads = jest.spyOn(OrdersRepository.prototype, 'findActiveSnapshot');

    const first = await get(created.id).expect(200);
    const ttl = await raw.ttl(cacheKey(created.id));
    const second = await get(created.id).expect(200);

    expect(first.body).toEqual(created);
    expect(second.body).toEqual(first.body);
    expect(snapshotReads).toHaveBeenCalledTimes(1);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
    const stored = JSON.parse((await raw.get(cacheKey(created.id))) ?? '{}');
    expect(stored.revision).toBe(1);
    expect(Object.keys(stored.data)).not.toContain('cacheRevision');
  });

  it('ignores an entry written for an older revision and replaces it (I29)', async () => {
    const created = await create();
    await get(created.id).expect(200);
    await patch(created.id, { status: 'SHIPPED' }).expect(200);

    const response = await get(created.id).expect(200);

    expect(response.body.status).toBe('SHIPPED');
    expect(JSON.parse((await raw.get(cacheKey(created.id))) ?? '{}').revision).toBe(2);
  });

  it('does not let a late cache write from an older read resurrect data after a PATCH (I29)', async () => {
    const created = await create();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let paused: () => void = () => undefined;
    const reachedPut = new Promise<void>((resolve) => {
      paused = resolve;
    });
    const realPut = cache.put.bind(cache);
    jest.spyOn(cache, 'put').mockImplementationOnce(async (...args) => {
      paused();
      await gate;
      return realPut(...args);
    });

    const oldRead = get(created.id).then((response) => response);
    await reachedPut;
    await patch(created.id, { status: 'CANCELED' }).expect(200);
    release();
    const old = await oldRead;
    const fresh = await get(created.id).expect(200);

    expect(old.body.status).toBe('PENDING');
    expect(fresh.body.status).toBe('CANCELED');
  });

  it('never resurrects a deleted order from a late cache write or a lingering entry (I26, I29)', async () => {
    const created = await create();
    await get(created.id).expect(200);
    await http().delete(`/api/v1/orders/${created.id}`).set('Authorization', auth).expect(204);

    const afterDelete = await get(created.id).expect(404);

    expect(afterDelete.body.code).toBe('ORDER_NOT_FOUND');
    await get(created.id).expect(404);
  });

  it('does not cache 404s, lists, or logins (I30)', async () => {
    await create();
    await get('00000000-0000-4000-8000-000000000000').expect(404);
    await http().get('/api/v1/orders').set('Authorization', auth).expect(200);
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'x@example.test', password: 'p' })
      .expect(401);

    expect(await raw.keys('*')).toEqual([]);
  });

  it('falls back to PostgreSQL and repairs the key when the cached payload is corrupt (I30)', async () => {
    const created = await create();
    await raw.set(cacheKey(created.id), '{"revision":1,"data":{"id":"x"}}');
    const before = cache.stats.errors;

    const response = await get(created.id).expect(200);

    expect(response.body).toEqual(created);
    expect(cache.stats.errors).toBe(before + 1);
    expect(JSON.parse((await raw.get(cacheKey(created.id))) ?? '{}').data.id).toBe(created.id);
  });

  it('counts hits, misses and errors without exposing any payload (CACHE-08)', async () => {
    const created = await create();
    const start = cache.stats;

    await get(created.id).expect(200);
    await get(created.id).expect(200);

    expect(cache.stats).toEqual({
      hits: start.hits + 1,
      misses: start.misses + 1,
      errors: start.errors,
    });
  });
});

describe('GET /api/v1/orders/:id while Redis is unavailable (I27)', () => {
  let env: IntegrationApp;
  let previous: string | undefined;

  beforeAll(async () => {
    previous = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://127.0.0.1:1';
    env = await createIntegrationApp();
  });
  afterAll(async () => {
    await env.app.close();
    if (previous === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previous;
  });

  it('serves reads, writes, lists and logins from PostgreSQL within the cache budget', async () => {
    const auth = await env.bearer();
    const created = (
      await request(env.app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', auth)
        .send(validOrderBody())
        .expect(201)
    ).body;

    const started = Date.now();
    const first = await request(env.app.getHttpServer())
      .get(`/api/v1/orders/${created.id}`)
      .set('Authorization', auth)
      .expect(200);
    await request(env.app.getHttpServer())
      .get(`/api/v1/orders/${created.id}`)
      .set('Authorization', auth)
      .expect(200);
    await request(env.app.getHttpServer())
      .get('/api/v1/orders')
      .set('Authorization', auth)
      .expect(200);

    expect(first.body).toEqual(created);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

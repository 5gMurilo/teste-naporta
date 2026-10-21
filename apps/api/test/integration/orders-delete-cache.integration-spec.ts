import { jest } from '@jest/globals';
import { createClient } from 'redis';
import request from 'supertest';
import { cacheKey, OrdersDetailCache } from '../../src/cache/orders-detail.cache.js';
import { RedisService } from '../../src/cache/redis.service.js';
import {
  createIntegrationApp,
  type IntegrationApp,
  validOrderBody,
} from '../helpers/integration-app.js';
import { createRedisTestContext, type RedisTestContext } from '../helpers/redis-test-context.js';

jest.setTimeout(180_000);

describe('DELETE invalidates the order detail cache', () => {
  let redisContext: RedisTestContext;
  let env: IntegrationApp;
  let auth: string;
  let raw: ReturnType<typeof createClient>;

  beforeAll(async () => {
    redisContext = await createRedisTestContext();
    env = await createIntegrationApp({ waitForRedis: true });
    auth = await env.bearer();
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
  const remove = (id: string) => http().delete(`/api/v1/orders/${id}`).set('Authorization', auth);
  const create = async () =>
    (
      await http()
        .post('/api/v1/orders')
        .set('Authorization', auth)
        .send(validOrderBody())
        .expect(201)
    ).body;

  it('removes the warmed entry and answers 404 afterwards without caching the absence (I26)', async () => {
    const created = await create();
    await get(created.id).expect(200);
    expect(await raw.exists(cacheKey(created.id))).toBe(1);

    await remove(created.id).expect(204);

    expect(await raw.exists(cacheKey(created.id))).toBe(0);
    const gone = await get(created.id).expect(404);
    expect(gone.body.code).toBe('ORDER_NOT_FOUND');
    expect(await raw.keys('*')).toEqual([]);
  });

  it('keeps the number reserved while the cache is empty (I26)', async () => {
    const created = await create();
    await get(created.id).expect(200);
    await remove(created.id).expect(204);

    await http()
      .post('/api/v1/orders')
      .set('Authorization', auth)
      .send(validOrderBody())
      .expect(409);
  });

  it('still answers 204 and then 404 even when the DEL fails and the old entry survives (I28)', async () => {
    const created = await create();
    await get(created.id).expect(200);
    jest
      .spyOn(env.app.get(RedisService), 'del')
      .mockRejectedValueOnce(new Error('Redis went away'));
    const errorsBefore = env.app.get(OrdersDetailCache).stats.errors;

    await remove(created.id).expect(204);

    expect(env.app.get(OrdersDetailCache).stats.errors).toBe(errorsBefore + 1);
    expect(await raw.exists(cacheKey(created.id))).toBe(1);
    await get(created.id).expect(404);
  });

  it('does not bring a deleted order back when an older read writes the cache after the delete (I29)', async () => {
    const created = await create();
    const cache = env.app.get(OrdersDetailCache);
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
    await remove(created.id).expect(204);
    release();
    const old = await oldRead;

    expect(old.status).toBe(200);
    expect(await raw.exists(cacheKey(created.id))).toBe(1);
    await get(created.id).expect(404);
    await http()
      .patch(`/api/v1/orders/${created.id}`)
      .set('Authorization', auth)
      .send({ status: 'SHIPPED' })
      .expect(404);
  });

  it('does not invalidate for an unknown id or a repeated delete', async () => {
    const created = await create();
    await get(created.id).expect(200);

    await remove('00000000-0000-4000-8000-000000000000').expect(404);

    expect(await raw.exists(cacheKey(created.id))).toBe(1);
  });
});

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

describe('PATCH invalidates the order detail cache', () => {
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
  const patch = (id: string, body: object) =>
    http().patch(`/api/v1/orders/${id}`).set('Authorization', auth).send(body);
  const create = async () =>
    (
      await http()
        .post('/api/v1/orders')
        .set('Authorization', auth)
        .send(validOrderBody())
        .expect(201)
    ).body;

  it('removes the warmed entry on PATCH and serves the new data with the new revision (I25)', async () => {
    const created = await create();
    await get(created.id).expect(200);
    expect(await raw.exists(cacheKey(created.id))).toBe(1);

    await patch(created.id, {
      status: 'DELIVERED',
      items: [{ description: 'Novo item', priceCents: 777 }],
    }).expect(200);

    expect(await raw.exists(cacheKey(created.id))).toBe(0);
    const fresh = await get(created.id).expect(200);
    expect(fresh.body.status).toBe('DELIVERED');
    expect(fresh.body.items.map((item: { description: string }) => item.description)).toEqual([
      'Novo item',
    ]);
    expect(fresh.body.totalCents).toBe(777);
    expect(JSON.parse((await raw.get(cacheKey(created.id))) ?? '{}').revision).toBe(2);
  });

  it('keeps the entry untouched when the PATCH rolls back (I25, U26)', async () => {
    const created = await create();
    await get(created.id).expect(200);
    await env.prisma.$executeRawUnsafe(`
      CREATE FUNCTION fail_marked_item() RETURNS trigger AS $$
      BEGIN
        IF NEW.description = 'FAIL-ITEM' THEN RAISE EXCEPTION 'induced item failure'; END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql`);
    await env.prisma.$executeRawUnsafe(
      'CREATE TRIGGER fail_marked_item BEFORE INSERT ON "OrderItem" FOR EACH ROW EXECUTE FUNCTION fail_marked_item()',
    );
    try {
      await patch(created.id, { items: [{ description: 'FAIL-ITEM', priceCents: 1 }] }).expect(500);
    } finally {
      await env.prisma.$executeRawUnsafe('DROP TRIGGER fail_marked_item ON "OrderItem"');
      await env.prisma.$executeRawUnsafe('DROP FUNCTION fail_marked_item()');
    }

    expect(await raw.exists(cacheKey(created.id))).toBe(1);
    const stillValid = await get(created.id).expect(200);
    expect(stillValid.body).toEqual(created);
  });

  it('does not invalidate for a 404, a 400, or a 409', async () => {
    const created = await create();
    await get(created.id).expect(200);

    await patch('00000000-0000-4000-8000-000000000000', { status: 'SHIPPED' }).expect(404);
    await patch(created.id, {}).expect(400);
    const other = (
      await http()
        .post('/api/v1/orders')
        .set('Authorization', auth)
        .send({ ...validOrderBody(), orderNumber: 'NP-OTHER' })
        .expect(201)
    ).body;
    await patch(other.id, { orderNumber: created.orderNumber }).expect(409);

    expect(await raw.exists(cacheKey(created.id))).toBe(1);
  });

  it('still answers 200 and never serves the old entry when the DEL fails (I28)', async () => {
    const created = await create();
    await get(created.id).expect(200);
    const redis = env.app.get(RedisService);
    const errorsBefore = env.app.get(OrdersDetailCache).stats.errors;
    jest.spyOn(redis, 'del').mockRejectedValueOnce(new Error('Redis went away during DEL'));

    const patched = await patch(created.id, { status: 'SHIPPED' }).expect(200);

    expect(patched.body.status).toBe('SHIPPED');
    expect(env.app.get(OrdersDetailCache).stats.errors).toBe(errorsBefore + 1);
    expect(await raw.exists(cacheKey(created.id))).toBe(1);
    const afterRecovery = await get(created.id).expect(200);
    expect(afterRecovery.body.status).toBe('SHIPPED');
    expect(JSON.parse((await raw.get(cacheKey(created.id))) ?? '{}').revision).toBe(2);
  });
});

import request from 'supertest';
import {
  createIntegrationApp,
  type IntegrationApp,
  validOrderBody,
} from '../helpers/integration-app.js';
import { queryFresh, waitForBlockedWriter } from '../helpers/postgres-locks.js';

describe('DELETE /api/v1/orders/:id with PostgreSQL', () => {
  let env: IntegrationApp;
  let auth: string;

  beforeAll(async () => {
    env = await createIntegrationApp();
    auth = await env.bearer();
  });
  afterAll(async () => env.app.close());

  const http = () => request(env.app.getHttpServer());
  const remove = (id: string, authorization: string | null = auth) => {
    const req = http().delete(`/api/v1/orders/${id}`);
    return authorization ? req.set('Authorization', authorization) : req;
  };
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

  it('answers 204 with no body bytes and keeps order and item rows with deletedAt set (I13)', async () => {
    const created = await create();

    const response = await remove(created.id).expect(204);

    expect(response.text).toBe('');
    expect(response.body).toEqual({});
    expect(response.headers['content-length'] ?? '0').toBe('0');
    const [row] = await queryFresh<{ deletedAt: Date | null; cacheRevision: number }>(
      'SELECT "deletedAt", "cacheRevision" FROM "Order" WHERE id = $1',
      [created.id],
    );
    expect(row?.deletedAt).toBeInstanceOf(Date);
    expect(row?.cacheRevision).toBe(2);
    expect(await env.prisma.orderItem.count({ where: { orderId: created.id } })).toBe(2);
  });

  it('turns every later read or write into 404 and removes the order from the list (I13)', async () => {
    const created = await create();
    const other = await create({ orderNumber: 'NP-OTHER' });
    await remove(created.id).expect(204);

    const again = await remove(created.id).expect(404);
    await http().get(`/api/v1/orders/${created.id}`).set('Authorization', auth).expect(404);
    await patch(created.id, { status: 'SHIPPED' }).expect(404);
    const list = await http().get('/api/v1/orders').set('Authorization', auth).expect(200);

    expect(again.body).toMatchObject({ status: 404, code: 'ORDER_NOT_FOUND' });
    expect(list.body.data.map((order: { id: string }) => order.id)).toEqual([other.id]);
    expect(list.body.meta.total).toBe(1);
  });

  it('keeps the order number reserved after deletion (I14)', async () => {
    const created = await create();
    await remove(created.id).expect(204);

    const reuse = await http()
      .post('/api/v1/orders')
      .set('Authorization', auth)
      .send(validOrderBody())
      .expect(409);

    expect(reuse.body.code).toBe('ORDER_NUMBER_ALREADY_EXISTS');
  });

  it('answers 404 for an unknown order, 400 for a malformed id, and 401 without a token', async () => {
    await remove('00000000-0000-4000-8000-000000000000').expect(404);
    const invalid = await remove('123').expect(400);
    await remove('00000000-0000-4000-8000-000000000000', null).expect(401);

    expect(invalid.body.errors).toEqual([{ field: 'id', message: expect.any(String) }]);
  });

  it('serializes PATCH against DELETE: the delete always lands and nothing is resurrected (I15)', async () => {
    for (let round = 0; round < 10; round += 1) {
      const created = await create({ orderNumber: `NP-RACE-${round}` });

      const [patched, deleted] = await Promise.all([
        patch(created.id, { status: 'CANCELED', items: [{ description: 'raced', priceCents: 7 }] }),
        remove(created.id),
      ]);

      expect(deleted.status).toBe(204);
      expect([200, 404]).toContain(patched.status);
      const [row] = await queryFresh<{ status: string; deletedAt: Date | null }>(
        'SELECT status, "deletedAt" FROM "Order" WHERE id = $1',
        [created.id],
      );
      expect(row?.deletedAt).not.toBeNull();
      expect(row?.status).toBe(patched.status === 200 ? 'CANCELED' : 'PENDING');
      await http().get(`/api/v1/orders/${created.id}`).set('Authorization', auth).expect(404);
    }
  });

  it('does not delete or alter an order that a concurrent transaction already deleted (I15)', async () => {
    const created = await create();
    let release: () => void = () => undefined;
    let locked: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const lockAcquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const deleter = env.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${created.id}::uuid FOR UPDATE`;
      locked();
      await held;
      await tx.order.update({
        where: { id: created.id },
        data: { deletedAt: new Date('2026-10-10T00:00:00.000Z'), cacheRevision: 50 },
      });
    });
    await lockAcquired;

    const pending = remove(created.id).then((response) => response);
    await waitForBlockedWriter(env.prisma);
    release();
    await deleter;
    const response = await pending;

    expect(response.status).toBe(404);
    const after = await env.prisma.order.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.deletedAt?.toISOString()).toBe('2026-10-10T00:00:00.000Z');
    expect(after.cacheRevision).toBe(50);
  });
});

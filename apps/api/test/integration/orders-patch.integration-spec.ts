import request from 'supertest';
import {
  createIntegrationApp,
  type IntegrationApp,
  validOrderBody,
} from '../helpers/integration-app.js';
import { queryFresh, waitForBlockedWriter } from '../helpers/postgres-locks.js';

describe('PATCH /api/v1/orders/:id with PostgreSQL', () => {
  let env: IntegrationApp;
  let auth: string;

  beforeAll(async () => {
    env = await createIntegrationApp();
    auth = await env.bearer();
  });
  afterAll(async () => env.app.close());

  const patch = (id: string, body: unknown, authorization: string | null = auth) => {
    const req = request(env.app.getHttpServer()).patch(`/api/v1/orders/${id}`);
    return (authorization ? req.set('Authorization', authorization) : req).send(body as object);
  };
  const create = async (override: Record<string, unknown> = {}) =>
    (
      await request(env.app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', auth)
        .send({ ...validOrderBody(), ...override })
        .expect(201)
    ).body;
  const stored = (id: string) =>
    env.prisma.order.findUniqueOrThrow({ where: { id }, include: { items: true } });

  it('keeps customer, address, items and item ids when only the status changes, and any transition works (I09)', async () => {
    const created = await create();

    for (const status of ['SHIPPED', 'PENDING', 'CANCELED', 'DELIVERED', 'PROCESSING', 'PENDING']) {
      const response = await patch(created.id, { status }).expect(200);
      expect(response.body.status).toBe(status);
    }

    const after = await patch(created.id, { status: 'SHIPPED' }).expect(200);
    expect(after.body.customer).toEqual(created.customer);
    expect(after.body.deliveryAddress).toEqual(created.deliveryAddress);
    expect(after.body.items).toEqual(created.items);
    expect(after.body.createdAt).toBe(created.createdAt);
    expect(new Date(after.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(created.updatedAt).getTime(),
    );
    expect((await stored(created.id)).cacheRevision).toBe(8);
  });

  it('replaces the item collection without orphans and the address without a stale complement (I10)', async () => {
    const created = await create();
    const { complement: _removed, ...addressWithoutComplement } = validOrderBody().deliveryAddress;

    const response = await patch(created.id, {
      deliveryAddress: addressWithoutComplement,
      customer: { name: 'Bia', document: 'NEW-DOC' },
      items: [{ description: 'Chá', priceCents: 1200 }],
    }).expect(200);

    expect(response.body.deliveryAddress).toEqual(addressWithoutComplement);
    expect(response.body.customer).toEqual({ name: 'Bia', document: 'NEW-DOC' });
    expect(response.body.items).toEqual([
      { id: expect.any(String), description: 'Chá', priceCents: 1200 },
    ]);
    expect(response.body.items[0].id).not.toBe(created.items[0].id);
    expect(response.body.totalCents).toBe(1200);
    expect(response.body.orderNumber).toBe(created.orderNumber);
    expect(response.body.expectedDeliveryDate).toBe(created.expectedDeliveryDate);
    expect(await env.prisma.orderItem.count()).toBe(1);
  });

  it('updates the order number and the delivery date', async () => {
    const created = await create();

    const response = await patch(created.id, {
      orderNumber: '  NP-RENAMED ',
      expectedDeliveryDate: '2026-12-25',
    }).expect(200);

    expect(response.body).toMatchObject({
      orderNumber: 'NP-RENAMED',
      expectedDeliveryDate: '2026-12-25',
    });
    expect(response.body.items).toEqual(created.items);
  });

  it('rolls back fields, items and revision when the item write fails inside the transaction (I12)', async () => {
    const created = await create();
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
      const failed = await patch(created.id, {
        status: 'CANCELED',
        customer: { name: 'Changed', document: 'CHANGED' },
        items: [
          { description: 'ok', priceCents: 1 },
          { description: 'FAIL-ITEM', priceCents: 2 },
        ],
      }).expect(500);
      expect(failed.body.code).toBe('INTERNAL_SERVER_ERROR');
    } finally {
      await env.prisma.$executeRawUnsafe('DROP TRIGGER fail_marked_item ON "OrderItem"');
      await env.prisma.$executeRawUnsafe('DROP FUNCTION fail_marked_item()');
    }

    const [order] = await queryFresh<{
      status: string;
      customerName: string;
      cacheRevision: number;
    }>('SELECT status, "customerName", "cacheRevision" FROM "Order" WHERE id = $1', [created.id]);
    const items = await queryFresh<{ description: string }>(
      'SELECT description FROM "OrderItem" WHERE "orderId" = $1 ORDER BY description',
      [created.id],
    );
    expect(order).toEqual({ status: 'PENDING', customerName: 'Ana Silva', cacheRevision: 1 });
    expect(items.map((item) => item.description)).toEqual(['Café especial', 'Caneca']);
  });

  it('returns 409 for a number held by another order, including a soft-deleted one, but allows keeping its own (I14)', async () => {
    const first = await create({ orderNumber: 'NP-A' });
    const second = await create({ orderNumber: 'NP-B' });
    const deleted = await create({ orderNumber: 'NP-GONE' });
    await env.prisma.order.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });

    const clash = await patch(second.id, { orderNumber: 'NP-A' }).expect(409);
    const clashWithDeleted = await patch(second.id, { orderNumber: 'NP-GONE' }).expect(409);
    await patch(first.id, { orderNumber: 'NP-A', status: 'SHIPPED' }).expect(200);

    for (const response of [clash, clashWithDeleted]) {
      expect(response.body).toMatchObject({ status: 409, code: 'ORDER_NUMBER_ALREADY_EXISTS' });
    }
    expect((await stored(second.id)).orderNumber).toBe('NP-B');
    expect((await stored(second.id)).cacheRevision).toBe(1);
  });

  it('lets only one of two orders claim the same new number concurrently (I14)', async () => {
    const one = await create({ orderNumber: 'NP-ONE' });
    const two = await create({ orderNumber: 'NP-TWO' });

    const results = await Promise.all([
      patch(one.id, { orderNumber: 'NP-RACE' }),
      patch(two.id, { orderNumber: 'NP-RACE' }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await env.prisma.order.count({ where: { orderNumber: 'NP-RACE' } })).toBe(1);
  });

  it('never mixes the items of two concurrent replacements (I10)', async () => {
    const created = await create();
    const setA = [1, 2, 3].map((n) => ({ description: `A${n}`, priceCents: n }));
    const setB = [1, 2, 3, 4].map((n) => ({ description: `B${n}`, priceCents: n }));

    for (let round = 0; round < 8; round += 1) {
      const results = await Promise.all([
        patch(created.id, { items: setA }),
        patch(created.id, { items: setB }),
      ]);
      expect(results.map((result) => result.status)).toEqual([200, 200]);
      const letters = new Set((await stored(created.id)).items.map((item) => item.description[0]));
      expect(letters.size).toBe(1);
      expect((await stored(created.id)).items).toHaveLength(letters.has('A') ? 3 : 4);
    }
  });

  it('does not update an order that a concurrent transaction deleted while the PATCH waited (I15)', async () => {
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
      await tx.order.update({ where: { id: created.id }, data: { deletedAt: new Date() } });
    });
    await lockAcquired;

    const pending = patch(created.id, {
      status: 'CANCELED',
      items: [{ description: 'late', priceCents: 1 }],
    }).then((response) => response);
    await waitForBlockedWriter(env.prisma);
    release();
    await deleter;
    const response = await pending;

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ORDER_NOT_FOUND');
    const after = await stored(created.id);
    expect(after.deletedAt).not.toBeNull();
    expect(after.status).toBe('PENDING');
    expect(after.items.map((item) => item.description).sort()).toEqual(['Café especial', 'Caneca']);
  });

  it('answers 404 for unknown and soft-deleted orders and writes nothing', async () => {
    const created = await create();
    await env.prisma.order.update({ where: { id: created.id }, data: { deletedAt: new Date() } });

    await patch('00000000-0000-4000-8000-000000000000', { status: 'SHIPPED' }).expect(404);
    const response = await patch(created.id, { status: 'SHIPPED' }).expect(404);

    expect(response.body.code).toBe('ORDER_NOT_FOUND');
    expect((await stored(created.id)).status).toBe('PENDING');
  });

  it.each([
    ['empty body', {}],
    ['null field', { status: null }],
    ['partial customer', { customer: { name: 'only' } }],
    ['partial address', { deliveryAddress: { street: 'x' } }],
    ['empty items', { items: [] }],
    ['unknown property', { quantity: 1 }],
    ['private id', { id: '00000000-0000-4000-8000-000000000000' }],
    ['deletedAt', { deletedAt: null }],
    ['impossible date', { expectedDeliveryDate: '2026-02-30' }],
  ])(
    'answers 400 VALIDATION_ERROR for %s and keeps the order unchanged (I19)',
    async (_name, body) => {
      const created = await create();

      const response = await patch(created.id, body).expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect((await stored(created.id)).cacheRevision).toBe(1);
    },
  );

  it('answers 400 for a malformed id and 401 without a bearer token', async () => {
    await patch('123', { status: 'SHIPPED' }).expect(400);
    await patch('00000000-0000-4000-8000-000000000000', { status: 'SHIPPED' }, null).expect(401);
  });
});

import request from 'supertest';
import {
  createIntegrationApp,
  type IntegrationApp,
  validOrderBody,
} from '../helpers/integration-app.js';
import { assertRequestedZoneApplied } from '../helpers/process-zone.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('POST /api/v1/orders with PostgreSQL', () => {
  let env: IntegrationApp;
  let auth: string;

  beforeAll(async () => {
    env = await createIntegrationApp();
    auth = await env.bearer();
  });
  afterAll(async () => env.app.close());
  beforeEach(() => {
    env.logs.length = 0;
  });

  const post = (body: unknown, authorization: string | null = auth) => {
    const req = request(env.app.getHttpServer()).post('/api/v1/orders');
    return (authorization ? req.set('Authorization', authorization) : req).send(body as object);
  };

  it('creates the order and items, defaults to PENDING, and returns Location (I07)', async () => {
    const response = await post(validOrderBody()).expect(201);

    expect(response.headers.location).toBe(`/api/v1/orders/${response.body.id}`);
    expect(response.body).toMatchObject({
      orderNumber: 'NP-2026-0001',
      status: 'PENDING',
      expectedDeliveryDate: '2026-11-03',
      totalCents: 4990,
      customer: { name: 'Ana Silva', document: '123.456.789-00' },
    });
    expect(response.body.id).toMatch(UUID);
    expect(response.body.items).toHaveLength(2);
    for (const item of response.body.items) expect(item.id).toMatch(UUID);

    const stored = await env.prisma.order.findUniqueOrThrow({
      where: { id: response.body.id },
      include: { items: true },
    });
    expect(stored.status).toBe('PENDING');
    expect(stored.items.map((item) => item.priceCents).sort()).toEqual([0, 4990]);
    expect(stored.deletedAt).toBeNull();
    expect(stored.cacheRevision).toBe(1);
  });

  it('persists trimmed text, uppercase state, and the exact civil date in the process time zone [tz] (I20)', async () => {
    assertRequestedZoneApplied();
    const body = {
      ...validOrderBody(),
      status: 'SHIPPED',
      orderNumber: '  NP-TRIM  ',
      deliveryAddress: { ...validOrderBody().deliveryAddress, state: ' sp ', city: '  Santos ' },
    };
    const response = await post(body).expect(201);

    const [row] = await env.prisma.$queryRaw<
      { orderNumber: string; date: string; address: { state: string; city: string } }[]
    >`SELECT "orderNumber", "expectedDeliveryDate"::text AS date, "deliveryAddress" AS address
      FROM "Order" WHERE id = ${response.body.id}::uuid`;
    expect(row).toMatchObject({
      orderNumber: 'NP-TRIM',
      date: '2026-11-03',
      address: { state: 'SP', city: 'Santos' },
    });
    expect(response.body.status).toBe('SHIPPED');
    expect(response.body.expectedDeliveryDate).toBe('2026-11-03');
  });

  it('accepts boundary values: past date, generic document, free item, 50 maximum items (I20)', async () => {
    const response = await post({
      ...validOrderBody(),
      orderNumber: 'NP-LIMITS',
      expectedDeliveryDate: '2000-01-01',
      customer: { name: 'N', document: 'ABC' },
      items: Array.from({ length: 50 }, (_, index) => ({
        description: `item ${index}`,
        priceCents: 2_000_000_000,
      })),
    }).expect(201);

    expect(response.body.totalCents).toBe(100_000_000_000);
    expect(response.body.items).toHaveLength(50);
  });

  it('rejects requests without a valid bearer token and writes nothing', async () => {
    await post(validOrderBody(), null).expect(401);
    await post(validOrderBody(), 'Bearer invalid').expect(401);

    expect(await env.prisma.order.count()).toBe(0);
  });

  it.each([
    ['impossible date', { expectedDeliveryDate: '2026-02-30' }],
    ['timestamp date', { expectedDeliveryDate: '2026-11-03T00:00:00Z' }],
    ['unknown property', { extra: 1 }],
    ['item quantity', { items: [{ description: 'x', priceCents: 1, quantity: 2 }] }],
    ['null customer', { customer: null }],
    ['no items', { items: [] }],
    ['fractional price', { items: [{ description: 'x', priceCents: 1.5 }] }],
    ['bad status', { status: 'LOST' }],
    ['NUL character', { orderNumber: 'a\u0000b' }],
  ])('returns 400 VALIDATION_ERROR for %s and stores nothing (I19)', async (_name, override) => {
    const response = await post({ ...validOrderBody(), ...override }).expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors.length).toBeGreaterThan(0);
    expect(await env.prisma.order.count()).toBe(0);
  });

  it('returns 409 for a duplicate order number, also when the first order was soft deleted (I14)', async () => {
    await post(validOrderBody()).expect(201);
    const duplicate = await post(validOrderBody()).expect(409);
    await env.prisma.order.updateMany({ data: { deletedAt: new Date() } });
    const afterDelete = await post(validOrderBody()).expect(409);

    for (const response of [duplicate, afterDelete]) {
      expect(response.body).toMatchObject({ status: 409, code: 'ORDER_NUMBER_ALREADY_EXISTS' });
    }
    expect(await env.prisma.order.count()).toBe(1);
  });

  it('lets exactly one of two concurrent creations reserve the same number (I14)', async () => {
    const results = await Promise.all([post(validOrderBody()), post(validOrderBody())]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await env.prisma.order.count()).toBe(1);
    expect(await env.prisma.orderItem.count()).toBe(2);
  });

  it('rolls back the order and reservation when an item insert fails in the database (I11)', async () => {
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
      const body = {
        ...validOrderBody(),
        items: [
          { description: 'fine', priceCents: 1 },
          { description: 'FAIL-ITEM', priceCents: 2 },
        ],
      };
      const failed = await post(body).expect(500);

      expect(failed.body.code).toBe('INTERNAL_SERVER_ERROR');
      expect(JSON.stringify(failed.body)).not.toMatch(/induced|trigger|OrderItem/);
      expect(await env.prisma.order.count()).toBe(0);
      expect(await env.prisma.orderItem.count()).toBe(0);
    } finally {
      await env.prisma.$executeRawUnsafe('DROP TRIGGER fail_marked_item ON "OrderItem"');
      await env.prisma.$executeRawUnsafe('DROP FUNCTION fail_marked_item()');
    }

    await post(validOrderBody()).expect(201);
  });
});

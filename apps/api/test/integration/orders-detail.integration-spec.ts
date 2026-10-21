import request from 'supertest';
import {
  createIntegrationApp,
  type IntegrationApp,
  validOrderBody,
} from '../helpers/integration-app.js';

describe('GET /api/v1/orders/:id with PostgreSQL', () => {
  let env: IntegrationApp;
  let auth: string;

  beforeAll(async () => {
    env = await createIntegrationApp();
    auth = await env.bearer();
  });
  afterAll(async () => env.app.close());

  const get = (id: string, authorization: string | null = auth) => {
    const req = request(env.app.getHttpServer()).get(`/api/v1/orders/${id}`);
    return authorization ? req.set('Authorization', authorization) : req;
  };
  const create = async (override: Record<string, unknown> = {}) =>
    (
      await request(env.app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', auth)
        .send({ ...validOrderBody(), ...override })
        .expect(201)
    ).body;

  it('returns exactly the public fields, the total, and the same body as creation (I08)', async () => {
    const created = await create();

    const response = await get(created.id).expect(200);

    expect(response.body).toEqual(created);
    expect(response.body.totalCents).toBe(4990);
    expect(Object.keys(response.body).sort()).toEqual(
      [
        'createdAt',
        'customer',
        'deliveryAddress',
        'expectedDeliveryDate',
        'id',
        'items',
        'orderNumber',
        'status',
        'totalCents',
        'updatedAt',
      ].sort(),
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /cacheRevision|deletedAt|passwordHash|orderId/,
    );
    expect(response.body.createdAt).toMatch(/Z$/);
  });

  it.each(['UTC', 'America/Sao_Paulo', 'Pacific/Kiritimati'])(
    'keeps the date 2026-11-03 and the 100000000000 maximum total under TZ=%s',
    async (zone) => {
      const previous = process.env.TZ;
      process.env.TZ = zone;
      try {
        const created = await create({
          orderNumber: `NP-MAX-${zone}`,
          items: Array.from({ length: 50 }, (_, index) => ({
            description: `item ${index}`,
            priceCents: 2_000_000_000,
          })),
        });

        const response = await get(created.id).expect(200);

        expect(response.body.expectedDeliveryDate).toBe('2026-11-03');
        expect(response.body.totalCents).toBe(100_000_000_000);
      } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
      }
    },
  );

  it('answers 404 ORDER_NOT_FOUND for unknown and soft-deleted orders', async () => {
    const created = await create({ orderNumber: 'NP-DELETED' });
    await env.prisma.order.update({ where: { id: created.id }, data: { deletedAt: new Date() } });

    const missing = await get('00000000-0000-4000-8000-000000000000').expect(404);
    const deleted = await get(created.id).expect(404);

    for (const response of [missing, deleted]) {
      expect(response.body).toMatchObject({ status: 404, code: 'ORDER_NOT_FOUND' });
      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    }
    expect(deleted.body.instance).toBe(`/api/v1/orders/${created.id}`);
  });

  it.each(['123', 'not-a-uuid', '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6'])(
    'answers 400 VALIDATION_ERROR on the id field for %s (I19)',
    async (id) => {
      const response = await get(id).expect(400);

      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.errors).toEqual([{ field: 'id', message: expect.any(String) }]);
    },
  );

  it('answers 401 without a valid bearer token (I06)', async () => {
    const created = await create({ orderNumber: 'NP-AUTH' });

    await get(created.id, null).expect(401);
    await get(created.id, 'Bearer garbage').expect(401);
  });

  it('lets two different authenticated users read the same order (AUTH-07)', async () => {
    const created = await create({ orderNumber: 'NP-SHARED' });

    const first = await get(created.id, await env.bearer('first@example.test')).expect(200);
    const second = await get(created.id, await env.bearer('second@example.test')).expect(200);

    expect(first.body).toEqual(second.body);
  });
});

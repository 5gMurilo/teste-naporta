import request from 'supertest';
import { createIntegrationApp, type IntegrationApp } from '../helpers/integration-app.js';

type Seed = {
  orderNumber: string;
  status?: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELED';
  createdAt?: string;
  id?: string;
  deletedAt?: Date | null;
};

describe('GET /api/v1/orders with PostgreSQL', () => {
  let env: IntegrationApp;
  let auth: string;

  beforeAll(async () => {
    env = await createIntegrationApp();
    auth = await env.bearer();
  });
  afterAll(async () => env.app.close());

  const seed = (orders: Seed[]) =>
    env.prisma.order.createMany({
      data: orders.map(({ createdAt, ...order }) => ({
        status: 'PENDING' as const,
        expectedDeliveryDate: new Date('2026-11-03T00:00:00.000Z'),
        customerName: 'Customer',
        customerDocument: 'DOC',
        deliveryAddress: { street: 'Street' },
        ...(createdAt && { createdAt: new Date(createdAt) }),
        ...order,
      })),
    });
  const list = (query = '', authorization: string | null = auth) => {
    const req = request(env.app.getHttpServer()).get(`/api/v1/orders${query}`);
    return authorization ? req.set('Authorization', authorization) : req;
  };
  const numbers = (body: { data: { orderNumber: string }[] }) =>
    body.data.map((order) => order.orderNumber);

  it('returns page 1 of 20 with the list envelope and only summary fields (I18)', async () => {
    await seed(Array.from({ length: 25 }, (_, i) => ({ orderNumber: `NP-${i}` })));

    const response = await list().expect(200);

    expect(response.body.meta).toEqual({ page: 1, pageSize: 20, total: 25, totalPages: 2 });
    expect(response.body.data).toHaveLength(20);
    expect(Object.keys(response.body.data[0]).sort()).toEqual(
      ['createdAt', 'customer', 'expectedDeliveryDate', 'id', 'orderNumber', 'status'].sort(),
    );
  });

  it('matches the order number exactly after trim, case-sensitive and never partially (I16)', async () => {
    await seed([
      { orderNumber: 'NP-2026-0001' },
      { orderNumber: 'np-2026-0001' },
      { orderNumber: 'NP-2026-00012' },
      { orderNumber: 'XNP-2026-0001' },
    ]);

    const response = await list(`?orderNumber=${encodeURIComponent(' NP-2026-0001 ')}`).expect(200);

    expect(numbers(response.body)).toEqual(['NP-2026-0001']);
    expect(response.body.meta.total).toBe(1);
  });

  it('filters by status alone and combines it with the order number by AND (I16)', async () => {
    await seed([
      { orderNumber: 'A', status: 'SHIPPED' },
      { orderNumber: 'B', status: 'SHIPPED' },
      { orderNumber: 'C', status: 'CANCELED' },
    ]);

    const byStatus = await list('?status=SHIPPED').expect(200);
    const combined = await list('?status=SHIPPED&orderNumber=B').expect(200);
    const disjoint = await list('?status=CANCELED&orderNumber=A').expect(200);

    expect(numbers(byStatus.body).sort()).toEqual(['A', 'B']);
    expect(numbers(combined.body)).toEqual(['B']);
    expect(disjoint.body).toMatchObject({ data: [], meta: { total: 0, totalPages: 0 } });
  });

  it('treats a civil day as [00:00:00Z, next 00:00:00Z) in every combination (I17)', async () => {
    await seed([
      { orderNumber: 'BEFORE', createdAt: '2026-10-20T23:59:59.999Z' },
      { orderNumber: 'START', createdAt: '2026-10-21T00:00:00.000Z' },
      { orderNumber: 'END', createdAt: '2026-10-21T23:59:59.999Z' },
      { orderNumber: 'NEXT', createdAt: '2026-10-22T00:00:00.000Z' },
    ]);

    const same = await list('?createdFrom=2026-10-21&createdTo=2026-10-21').expect(200);
    const fromOnly = await list('?createdFrom=2026-10-21').expect(200);
    const toOnly = await list('?createdTo=2026-10-21').expect(200);
    const range = await list('?createdFrom=2026-10-20&createdTo=2026-10-22').expect(200);

    expect(numbers(same.body).sort()).toEqual(['END', 'START']);
    expect(numbers(fromOnly.body).sort()).toEqual(['END', 'NEXT', 'START']);
    expect(numbers(toOnly.body).sort()).toEqual(['BEFORE', 'END', 'START']);
    expect(range.body.meta.total).toBe(4);
  });

  it('sorts by createdAt DESC then id DESC and omits soft-deleted orders (I18, LIST-04)', async () => {
    const ids = [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000002',
    ];
    await seed([
      { orderNumber: 'TIE-1', id: ids[0], createdAt: '2026-10-21T10:00:00.000Z' },
      { orderNumber: 'TIE-3', id: ids[1], createdAt: '2026-10-21T10:00:00.000Z' },
      { orderNumber: 'TIE-2', id: ids[2], createdAt: '2026-10-21T10:00:00.000Z' },
      { orderNumber: 'NEWER', createdAt: '2026-10-21T11:00:00.000Z' },
      { orderNumber: 'GONE', createdAt: '2026-10-21T12:00:00.000Z', deletedAt: new Date() },
    ]);

    const response = await list().expect(200);

    expect(numbers(response.body)).toEqual(['NEWER', 'TIE-3', 'TIE-2', 'TIE-1']);
    expect(response.body.meta.total).toBe(4);
  });

  it('paginates with custom sizes, past the end, and when empty (I18)', async () => {
    await seed(
      Array.from({ length: 7 }, (_, i) => ({
        orderNumber: `P-${i}`,
        createdAt: `2026-10-21T10:00:0${i}.000Z`,
      })),
    );

    const second = await list('?page=2&pageSize=3').expect(200);
    const beyond = await list('?page=9&pageSize=3').expect(200);

    expect(numbers(second.body)).toEqual(['P-3', 'P-2', 'P-1']);
    expect(second.body.meta).toEqual({ page: 2, pageSize: 3, total: 7, totalPages: 3 });
    expect(beyond.body).toEqual({
      data: [],
      meta: { page: 9, pageSize: 3, total: 7, totalPages: 3 },
    });
  });

  it('returns an empty first page with totalPages 0 when nothing matches (I18)', async () => {
    const response = await list().expect(200);

    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
  });

  it.each([
    ['page zero', '?page=0'],
    ['pageSize 101', '?pageSize=101'],
    ['pageSize zero', '?pageSize=0'],
    ['fractional page', '?page=1.5'],
    ['empty page', '?page='],
    ['repeated page', '?page=1&page=2'],
    ['nested page', '?page[a]=1'],
    ['invalid status', '?status=LOST'],
    ['unknown filter', '?customerName=Ana'],
    ['impossible date', '?createdFrom=2026-02-30'],
    ['timestamp date', '?createdTo=2026-10-21T00:00:00Z'],
    ['inverted period', '?createdFrom=2026-10-22&createdTo=2026-10-21'],
    ['blank order number', '?orderNumber=%20'],
  ])('answers 400 VALIDATION_ERROR for %s (I19)', async (_name, query) => {
    const response = await list(query).expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  it('requires a valid bearer token (I06)', async () => {
    await list('', null).expect(401);
    await list('', 'Bearer nope').expect(401);
  });
});

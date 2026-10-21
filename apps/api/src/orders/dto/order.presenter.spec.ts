import { assertRequestedZoneApplied } from '../../../test/helpers/process-zone.js';
import type { OrderDetailModel, OrderSummaryModel } from '../orders.projections.js';
import { OrderPresenter } from './order.presenter.js';
import {
  listOrdersResponseSchema,
  orderResponseSchema,
  orderSummaryResponseSchema,
} from './order.responses.js';

const address = {
  street: 'Rua das Flores',
  number: '101',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  postalCode: '01001000',
};

function detailModel(overrides: Partial<OrderDetailModel> = {}): OrderDetailModel {
  return {
    id: '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
    orderNumber: 'NP-1',
    status: 'PENDING',
    expectedDeliveryDate: new Date('2026-11-03T00:00:00.000Z'),
    customerName: 'Ana Silva',
    customerDocument: 'DOC-1',
    deliveryAddress: address,
    createdAt: new Date('2026-10-21T12:30:45.123Z'),
    updatedAt: new Date('2026-10-22T01:02:03.004Z'),
    items: [
      { id: '1b4e28ba-2fa1-4d3b-a3fd-27d4f4b9d0a1', description: 'Café', priceCents: 4990 },
      { id: '2c5f39cb-3fb2-4e4c-b4ae-38e5a5c0e1b2', description: 'Caneca', priceCents: 0 },
    ],
    ...overrides,
  };
}

describe('OrderPresenter.detail (U19, U20)', () => {
  it('returns exactly the public fields and sums the item prices', () => {
    const response = OrderPresenter.detail(detailModel());

    expect(Object.keys(response).sort()).toEqual(
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
    expect(response.totalCents).toBe(4990);
    expect(response.customer).toEqual({ name: 'Ana Silva', document: 'DOC-1' });
    expect(orderResponseSchema.safeParse(response).success).toBe(true);
  });

  it('never leaks internal fields even when the model carries them', () => {
    const leaky = {
      ...detailModel(),
      cacheRevision: 7,
      deletedAt: new Date(),
      passwordHash: 'hash',
      items: [
        {
          id: '1b4e28ba-2fa1-4d3b-a3fd-27d4f4b9d0a1',
          description: 'd',
          priceCents: 1,
          orderId: 'x',
        },
      ],
    } as unknown as OrderDetailModel;

    const raw = JSON.stringify(OrderPresenter.detail(leaky));

    expect(raw).not.toMatch(/cacheRevision|deletedAt|passwordHash|orderId/);
  });

  it('keeps 50 maximum priced items within safe integer arithmetic', () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      id: `1b4e28ba-2fa1-4d3b-a3fd-27d4f4b9d${String(index).padStart(3, '0')}`,
      description: 'max',
      priceCents: 2_000_000_000,
    }));

    expect(OrderPresenter.detail(detailModel({ items })).totalCents).toBe(100_000_000_000);
  });

  it('keeps the civil delivery date 2026-11-03 and emits UTC instants in the process time zone [tz]', () => {
    assertRequestedZoneApplied();

    const response = OrderPresenter.detail(detailModel());

    expect(response.expectedDeliveryDate).toBe('2026-11-03');
    expect(response.createdAt).toBe('2026-10-21T12:30:45.123Z');
    expect(response.updatedAt).toBe('2026-10-22T01:02:03.004Z');
  });

  it('omits complement when absent and keeps it when stored', () => {
    expect(OrderPresenter.detail(detailModel()).deliveryAddress).not.toHaveProperty('complement');
    const withComplement = detailModel({ deliveryAddress: { ...address, complement: 'Apto 2' } });

    expect(OrderPresenter.detail(withComplement).deliveryAddress.complement).toBe('Apto 2');
  });

  it('fails instead of exposing a stored address that does not match the contract', () => {
    expect(() =>
      OrderPresenter.detail(detailModel({ deliveryAddress: { street: 'only' } })),
    ).toThrow();
  });
});

describe('OrderPresenter.summary and list', () => {
  const summaryModel = (): OrderSummaryModel => ({
    id: '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
    orderNumber: 'NP-1',
    status: 'SHIPPED',
    expectedDeliveryDate: new Date('2026-11-03T00:00:00.000Z'),
    customerName: 'Ana Silva',
    customerDocument: 'DOC-1',
    createdAt: new Date('2026-10-21T12:30:45.123Z'),
  });

  it('projects only summary fields', () => {
    const response = OrderPresenter.summary(summaryModel());

    expect(Object.keys(response).sort()).toEqual(
      ['createdAt', 'customer', 'expectedDeliveryDate', 'id', 'orderNumber', 'status'].sort(),
    );
    expect(orderSummaryResponseSchema.safeParse(response).success).toBe(true);
  });

  it.each([
    [0, 20, 0],
    [1, 20, 1],
    [20, 20, 1],
    [21, 20, 2],
    [101, 100, 2],
  ])('computes totalPages for total=%i pageSize=%i as %i', (total, pageSize, totalPages) => {
    const response = OrderPresenter.list([], total, 3, pageSize);

    expect(response.meta).toEqual({ page: 3, pageSize, total, totalPages });
    expect(response.data).toEqual([]);
    expect(listOrdersResponseSchema.safeParse(response).success).toBe(true);
  });

  it('maps every model of the page in order', () => {
    const other = {
      ...summaryModel(),
      id: '7d1c2d43-9c5e-4a54-9d2c-1e5d05ae8b7c',
      orderNumber: 'NP-2',
    };

    const response = OrderPresenter.list([summaryModel(), other as OrderSummaryModel], 2, 1, 20);

    expect(response.data.map((order) => order.orderNumber)).toEqual(['NP-1', 'NP-2']);
  });
});

import { jest } from '@jest/globals';
import type { OrdersDetailCache } from '../cache/orders-detail.cache.js';
import { OrderNotFoundError } from '../common/errors/domain-errors.js';
import type { OrderResponse } from './dto/order.responses.js';
import type { OrderSnapshotModel } from './orders.projections.js';
import type { OrdersService } from './orders.service.js';
import { OrdersDetailReader } from './orders-detail.reader.js';

const ID = '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b';

const snapshot = (cacheRevision: number, orderNumber = 'NP-1'): OrderSnapshotModel => ({
  id: ID,
  orderNumber,
  status: 'PENDING',
  expectedDeliveryDate: new Date('2026-11-03T00:00:00.000Z'),
  customerName: 'Ana Silva',
  customerDocument: 'DOC-1',
  deliveryAddress: {
    street: 'Rua',
    number: '1',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01001000',
  },
  createdAt: new Date('2026-10-21T12:30:45.123Z'),
  updatedAt: new Date('2026-10-21T12:30:45.123Z'),
  items: [{ id: '1b4e28ba-2fa1-4d3b-a3fd-27d4f4b9d0a1', description: 'Café', priceCents: 4990 }],
  cacheRevision,
});

function setup(options: {
  revision?: number | OrderNotFoundError;
  snapshot?: OrderSnapshotModel | OrderNotFoundError;
  cached?: OrderResponse | null;
}) {
  const orders = {
    getActiveRevision: jest.fn(async (_id: string) => {
      if (options.revision instanceof OrderNotFoundError) throw options.revision;
      return options.revision ?? 1;
    }),
    getActiveSnapshot: jest.fn(async (_id: string) => {
      if (options.snapshot instanceof OrderNotFoundError) throw options.snapshot;
      return options.snapshot ?? snapshot(1);
    }),
  };
  const cache = {
    get: jest.fn(async (_id: string, _revision: number) => options.cached ?? null),
    put: jest.fn(async (_id: string, _revision: number, _data: OrderResponse) => undefined),
  };
  const reader = new OrdersDetailReader(
    orders as unknown as OrdersService,
    cache as unknown as OrdersDetailCache,
  );
  return { reader, orders, cache };
}

describe('OrdersDetailReader (U24, U27)', () => {
  it('on a miss loads the snapshot, answers from it, and caches it under the snapshot revision', async () => {
    const { reader, orders, cache } = setup({ revision: 1, snapshot: snapshot(1) });

    const response = await reader.read(ID);

    expect(response.orderNumber).toBe('NP-1');
    expect(response.totalCents).toBe(4990);
    expect(cache.get).toHaveBeenCalledWith(ID, 1);
    expect(orders.getActiveSnapshot).toHaveBeenCalledTimes(1);
    expect(cache.put).toHaveBeenCalledWith(ID, 1, response);
  });

  it('on a hit returns the cached detail without loading items or writing the cache', async () => {
    const cached = { id: ID, orderNumber: 'FROM-CACHE' } as OrderResponse;
    const { reader, orders, cache } = setup({ revision: 4, cached });

    await expect(reader.read(ID)).resolves.toBe(cached);

    expect(cache.get).toHaveBeenCalledWith(ID, 4);
    expect(orders.getActiveSnapshot).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('answers 404 for a missing order without touching the cache at all', async () => {
    const { reader, cache } = setup({ revision: new OrderNotFoundError() });

    await expect(reader.read(ID)).rejects.toBeInstanceOf(OrderNotFoundError);

    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('answers 404 and caches nothing when the order disappears between the check and the load', async () => {
    const { reader, cache } = setup({ revision: 1, snapshot: new OrderNotFoundError() });

    await expect(reader.read(ID)).rejects.toBeInstanceOf(OrderNotFoundError);

    expect(cache.put).not.toHaveBeenCalled();
  });

  it('keys the new entry to the revision of the snapshot it was built from, not the one checked earlier', async () => {
    const { reader, cache } = setup({ revision: 1, snapshot: snapshot(2, 'NP-AFTER-WRITE') });

    const response = await reader.read(ID);

    expect(response.orderNumber).toBe('NP-AFTER-WRITE');
    expect(cache.put).toHaveBeenCalledWith(ID, 2, response);
  });
});

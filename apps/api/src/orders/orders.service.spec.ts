import { jest } from '@jest/globals';
import type { OrdersDetailCache } from '../cache/orders-detail.cache.js';
import {
  OrderNotFoundError,
  OrderNumberAlreadyExistsError,
} from '../common/errors/domain-errors.js';
import { Prisma } from '../generated/prisma/client.js';
import type { OrderDetailModel } from './orders.projections.js';
import type { NewOrder, OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';
import { createOrderRequestSchema } from './schemas/orders.schemas.js';

const noCache = {
  invalidate: jest.fn(async (_id: string) => undefined),
} as unknown as OrdersDetailCache;

const request = createOrderRequestSchema.parse({
  orderNumber: 'NP-1',
  expectedDeliveryDate: '2026-11-03',
  customer: { name: 'Ana', document: 'D' },
  deliveryAddress: {
    street: 's',
    number: '1',
    neighborhood: 'n',
    city: 'c',
    state: 'sp',
    postalCode: '01001000',
  },
  items: [{ description: 'i', priceCents: 1 }],
});

function service(create: jest.Mock<(order: NewOrder) => Promise<OrderDetailModel>>) {
  return new OrdersService({ create } as unknown as OrdersRepository, noCache);
}

describe('OrdersService.create (U14)', () => {
  it('applies PENDING when the status is omitted and delegates one atomic write', async () => {
    const created = { id: 'x' } as OrderDetailModel;
    const create = jest.fn(async (_order: NewOrder) => created);

    await expect(service(create).create(request)).resolves.toBe(created);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toMatchObject({ status: 'PENDING', orderNumber: 'NP-1' });
  });

  it('keeps an explicit status', async () => {
    const create = jest.fn(async (_order: NewOrder) => ({}) as OrderDetailModel);

    await service(create).create({ ...request, status: 'DELIVERED' });

    expect(create.mock.calls[0]?.[0].status).toBe('DELIVERED');
  });

  it('translates the orderNumber unique violation into the domain conflict', async () => {
    const violation = new Prisma.PrismaClientKnownRequestError('x', {
      code: 'P2002',
      clientVersion: 'test',
      meta: {
        driverAdapterError: {
          cause: {
            kind: 'UniqueConstraintViolation',
            constraint: { index: 'Order_orderNumber_key' },
          },
        },
      },
    });

    await expect(
      service(jest.fn(async () => Promise.reject(violation))).create(request),
    ).rejects.toBeInstanceOf(OrderNumberAlreadyExistsError);
  });

  it('rethrows unrelated failures untouched', async () => {
    const failure = new Error('connection lost');

    await expect(
      service(jest.fn(async () => Promise.reject(failure))).create(request),
    ).rejects.toBe(failure);
  });
});

describe('OrdersService.getActiveSnapshot (U15)', () => {
  const repo = (found: unknown) =>
    new OrdersService(
      {
        findActiveSnapshot: jest.fn(async () => found),
      } as unknown as OrdersRepository,
      noCache,
    );

  it('returns the active projection', async () => {
    const snapshot = { id: 'a', cacheRevision: 3 };

    await expect(repo(snapshot).getActiveSnapshot('a')).resolves.toBe(snapshot);
  });

  it('turns a missing or deleted order into ORDER_NOT_FOUND', async () => {
    const error = await repo(null)
      .getActiveSnapshot('a')
      .catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(OrderNotFoundError);
    expect((error as OrderNotFoundError).code).toBe('ORDER_NOT_FOUND');
    expect((error as OrderNotFoundError).status).toBe(404);
  });
});

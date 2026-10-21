import { jest } from '@jest/globals';
import type { OrdersDetailCache } from '../cache/orders-detail.cache.js';
import { OrderNotFoundError } from '../common/errors/domain-errors.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { OrderDetailModel } from './orders.projections.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';
import { updateOrderRequestSchema } from './schemas/orders.schemas.js';

const noCache = {
  invalidate: jest.fn(async (_id: string) => undefined),
} as unknown as OrdersDetailCache;

const address = {
  street: 's',
  number: '1',
  neighborhood: 'n',
  city: 'c',
  state: 'SP',
  postalCode: '01001000',
};

function fakeTransaction(updateCount = 1) {
  const calls: string[] = [];
  const tx = {
    order: {
      updateMany: jest.fn(async (_args: unknown) => {
        calls.push('updateMany');
        return { count: updateCount };
      }),
      findUniqueOrThrow: jest.fn(async (_args: unknown) => {
        calls.push('read');
        return { id: 'o' } as unknown as OrderDetailModel;
      }),
    },
    orderItem: {
      deleteMany: jest.fn(async (_args: unknown) => {
        calls.push('deleteItems');
        return { count: 2 };
      }),
      createMany: jest.fn(async (_args: unknown) => {
        calls.push('createItems');
        return { count: 1 };
      }),
    },
  };
  const options: unknown[] = [];
  const prisma = {
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>, opts: unknown) => {
      options.push(opts);
      return callback(tx);
    }),
  } as unknown as PrismaService;
  return { tx, calls, options, repository: new OrdersRepository(prisma) };
}

describe('OrdersRepository.patchActive (U16)', () => {
  it('updates only the sent scalars, bumps the revision, and leaves items alone when omitted', async () => {
    const { tx, calls, options, repository } = fakeTransaction();

    await repository.patchActive('id-1', updateOrderRequestSchema.parse({ status: 'PENDING' }));

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'id-1', deletedAt: null },
      data: { status: 'PENDING', cacheRevision: { increment: 1 } },
    });
    expect(calls).toEqual(['updateMany', 'read']);
    expect(options).toEqual([{ isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }]);
  });

  it('replaces customer and address as whole objects and converts the date to UTC midnight', async () => {
    const { tx, repository } = fakeTransaction();

    await repository.patchActive(
      'id-1',
      updateOrderRequestSchema.parse({
        orderNumber: 'NP-2',
        expectedDeliveryDate: '2026-12-01',
        customer: { name: 'New', document: 'D2' },
        deliveryAddress: address,
      }),
    );

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'id-1', deletedAt: null },
      data: {
        orderNumber: 'NP-2',
        expectedDeliveryDate: new Date('2026-12-01T00:00:00.000Z'),
        customerName: 'New',
        customerDocument: 'D2',
        deliveryAddress: address,
        cacheRevision: { increment: 1 },
      },
    });
  });

  it('touches items only after the parent update, deleting before creating', async () => {
    const { tx, calls, repository } = fakeTransaction();

    await repository.patchActive(
      'id-1',
      updateOrderRequestSchema.parse({ items: [{ description: 'new', priceCents: 5 }] }),
    );

    expect(calls).toEqual(['updateMany', 'deleteItems', 'createItems', 'read']);
    expect(tx.orderItem.deleteMany).toHaveBeenCalledWith({ where: { orderId: 'id-1' } });
    expect(tx.orderItem.createMany).toHaveBeenCalledWith({
      data: [{ orderId: 'id-1', description: 'new', priceCents: 5 }],
    });
  });

  it('stops with ORDER_NOT_FOUND before any item write when the conditional update matches nothing', async () => {
    const { tx, calls, repository } = fakeTransaction(0);

    await expect(
      repository.patchActive(
        'id-1',
        updateOrderRequestSchema.parse({ items: [{ description: 'x', priceCents: 1 }] }),
      ),
    ).rejects.toBeInstanceOf(OrderNotFoundError);

    expect(calls).toEqual(['updateMany']);
    expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
  });
});

describe('OrdersService.patch', () => {
  it('delegates and maps the orderNumber unique violation to the domain conflict', async () => {
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
    const service = new OrdersService(
      {
        patchActive: jest.fn(async () => Promise.reject(violation)),
      } as unknown as OrdersRepository,
      noCache,
    );

    await expect(service.patch('id', { status: 'SHIPPED' })).rejects.toMatchObject({
      code: 'ORDER_NUMBER_ALREADY_EXISTS',
    });
  });

  it('returns the repository result and lets other domain errors through', async () => {
    const found = { id: 'x' } as OrderDetailModel;
    const ok = new OrdersService(
      {
        patchActive: jest.fn(async () => found),
      } as unknown as OrdersRepository,
      noCache,
    );
    const missing = new OrdersService(
      {
        patchActive: jest.fn(async () => Promise.reject(new OrderNotFoundError())),
      } as unknown as OrdersRepository,
      noCache,
    );

    await expect(ok.patch('id', { status: 'SHIPPED' })).resolves.toBe(found);
    await expect(missing.patch('id', { status: 'SHIPPED' })).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
  });
});

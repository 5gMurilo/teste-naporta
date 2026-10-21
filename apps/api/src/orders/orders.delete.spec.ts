import { jest } from '@jest/globals';
import type { OrdersDetailCache } from '../cache/orders-detail.cache.js';
import { OrderNotFoundError } from '../common/errors/domain-errors.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';

const noCache = {
  invalidate: jest.fn(async (_id: string) => undefined),
} as unknown as OrdersDetailCache;

describe('soft delete (U17)', () => {
  function repositoryWith(count: number) {
    // Only updateMany exists on the fake: any physical delete would throw a TypeError.
    const updateMany = jest.fn(async (_args: unknown) => ({ count }));
    const repository = new OrdersRepository({ order: { updateMany } } as unknown as PrismaService);
    return { repository, updateMany };
  }

  it('marks deletedAt and bumps the revision conditionally on an active order, never removing rows', async () => {
    const { repository, updateMany } = repositoryWith(1);

    await expect(repository.softDeleteActive('id-1')).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'id-1', deletedAt: null },
      data: { deletedAt: expect.any(Date), cacheRevision: { increment: 1 } },
    });
  });

  it('reports no change when the order was missing or already deleted', async () => {
    await expect(repositoryWith(0).repository.softDeleteActive('id-1')).resolves.toBe(false);
  });

  it('resolves silently for count 1 and raises ORDER_NOT_FOUND for count 0', async () => {
    const ok = new OrdersService(
      {
        softDeleteActive: jest.fn(async () => true),
      } as unknown as OrdersRepository,
      noCache,
    );
    const none = new OrdersService(
      {
        softDeleteActive: jest.fn(async () => false),
      } as unknown as OrdersRepository,
      noCache,
    );

    await expect(ok.delete('id')).resolves.toBeUndefined();
    await expect(none.delete('id')).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});

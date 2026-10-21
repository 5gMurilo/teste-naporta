import { jest } from '@jest/globals';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { orderSnapshotSelect } from './orders.projections.js';
import { OrdersRepository } from './orders.repository.js';

describe('OrdersRepository.findActiveSnapshot', () => {
  it('reads the active order with items and revision in one RepeatableRead transaction', async () => {
    const findFirst = jest.fn(async (_args: unknown) => ({ id: 'order' }));
    const transaction = jest.fn(
      async (callback: (tx: unknown) => Promise<unknown>, _options: { isolationLevel: unknown }) =>
        callback({ order: { findFirst } }),
    );
    const repository = new OrdersRepository({
      $transaction: transaction,
    } as unknown as PrismaService);

    await expect(repository.findActiveSnapshot('id-1')).resolves.toEqual({ id: 'order' });

    expect(transaction.mock.calls[0]?.[1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'id-1', deletedAt: null },
      select: orderSnapshotSelect,
    });
    expect(orderSnapshotSelect.cacheRevision).toBe(true);
    expect(JSON.stringify(orderSnapshotSelect)).not.toMatch(/passwordHash|deletedAt/);
  });
});

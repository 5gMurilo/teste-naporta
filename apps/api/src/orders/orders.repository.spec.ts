import { jest } from '@jest/globals';
import { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { orderSnapshotSelect, orderSummarySelect } from './orders.projections.js';
import { OrdersRepository } from './orders.repository.js';
import { listOrdersQuerySchema } from './schemas/orders.schemas.js';

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

describe('OrdersRepository.list (U18)', () => {
  function setup() {
    const findMany = jest.fn(async (_args: unknown) => [{ id: 'o1' }]);
    const count = jest.fn(async (_args: unknown) => 41);
    const repository = new OrdersRepository({
      order: { findMany, count },
    } as unknown as PrismaService);
    return { repository, findMany, count };
  }

  it('applies only the active filter, the default sort, and page 1 of 20 without filters', async () => {
    const { repository, findMany, count } = setup();

    await repository.list(listOrdersQuerySchema.parse({}));

    expect(findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      select: orderSummarySelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 20,
    });
    expect(count).toHaveBeenCalledWith({ where: { deletedAt: null } });
  });

  it('combines every filter with AND, exact number, and half open UTC bounds, reusing the same where for count', async () => {
    const { repository, findMany, count } = setup();
    const query = listOrdersQuerySchema.parse({
      orderNumber: ' NP-1 ',
      status: 'SHIPPED',
      createdFrom: '2026-10-21',
      createdTo: '2026-10-21',
      page: '3',
      pageSize: '10',
    });

    await expect(repository.list(query)).resolves.toEqual({ orders: [{ id: 'o1' }], total: 41 });

    const expectedWhere = {
      deletedAt: null,
      orderNumber: 'NP-1',
      status: 'SHIPPED',
      createdAt: {
        gte: new Date('2026-10-21T00:00:00.000Z'),
        lt: new Date('2026-10-22T00:00:00.000Z'),
      },
    };
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ where: expectedWhere, skip: 20, take: 10 });
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it('never selects items or private columns and supports one sided periods', async () => {
    const { repository, findMany } = setup();

    await repository.list(listOrdersQuerySchema.parse({ createdTo: '2026-10-21' }));

    const args = findMany.mock.calls[0]?.[0] as { where: unknown; select: Record<string, unknown> };
    expect(args.where).toEqual({
      deletedAt: null,
      createdAt: { lt: new Date('2026-10-22T00:00:00.000Z') },
    });
    expect(Object.keys(args.select)).not.toEqual(expect.arrayContaining(['items']));
    expect(JSON.stringify(args.select)).not.toMatch(
      /items|deliveryAddress|cacheRevision|deletedAt/,
    );
  });
});

import { Injectable } from '@nestjs/common';
import { OrderNotFoundError } from '../common/errors/domain-errors.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type OrderDetailModel,
  type OrderSnapshotModel,
  type OrderSummaryModel,
  orderDetailSelect,
  orderSnapshotSelect,
  orderSummarySelect,
} from './orders.projections.js';
import {
  type CreateOrderRequest,
  type ListOrdersQuery,
  startOfDayUtc,
  type UpdateOrderRequest,
} from './schemas/orders.schemas.js';

export type NewOrder = CreateOrderRequest & { status: NonNullable<CreateOrderRequest['status']> };

@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Nested write: order and items are inserted in one transaction. */
  create(order: NewOrder): Promise<OrderDetailModel> {
    return this.prisma.order.create({
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        expectedDeliveryDate: startOfDayUtc(order.expectedDeliveryDate),
        customerName: order.customer.name,
        customerDocument: order.customer.document,
        deliveryAddress: order.deliveryAddress,
        items: {
          create: order.items.map(({ description, priceCents }) => ({ description, priceCents })),
        },
      },
      select: orderDetailSelect,
    });
  }

  /**
   * Order, items and revision come from one RepeatableRead snapshot: Prisma issues one query for
   * the order and another for its items, which must not observe different committed states.
   */
  findActiveSnapshot(id: string): Promise<OrderSnapshotModel | null> {
    return this.prisma.$transaction(
      (tx) => tx.order.findFirst({ where: { id, deletedAt: null }, select: orderSnapshotSelect }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** One where clause feeds both the page and the count, so `total` always matches the filter. */
  async list(query: ListOrdersQuery): Promise<{ orders: OrderSummaryModel[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      ...(query.orderNumber !== undefined && { orderNumber: query.orderNumber }),
      ...(query.status !== undefined && { status: query.status }),
      ...((query.createdAtFrom || query.createdAtBefore) && {
        createdAt: {
          ...(query.createdAtFrom && { gte: query.createdAtFrom }),
          ...(query.createdAtBefore && { lt: query.createdAtBefore }),
        },
      }),
    };
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: orderSummarySelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { orders, total };
  }

  /**
   * Parent row first: the conditional update takes the row lock, so a concurrent PATCH or DELETE
   * waits and then re-evaluates `deletedAt IS NULL` (ReadCommitted). Items are only touched after
   * the lock is held, so collection replacements never interleave.
   */
  patchActive(id: string, changes: UpdateOrderRequest): Promise<OrderDetailModel> {
    return this.prisma.$transaction(
      async (tx) => {
        const { count } = await tx.order.updateMany({
          where: { id, deletedAt: null },
          data: {
            ...(changes.orderNumber !== undefined && { orderNumber: changes.orderNumber }),
            ...(changes.status !== undefined && { status: changes.status }),
            ...(changes.expectedDeliveryDate !== undefined && {
              expectedDeliveryDate: startOfDayUtc(changes.expectedDeliveryDate),
            }),
            ...(changes.customer && {
              customerName: changes.customer.name,
              customerDocument: changes.customer.document,
            }),
            ...(changes.deliveryAddress && { deliveryAddress: changes.deliveryAddress }),
            cacheRevision: { increment: 1 },
          },
        });
        if (count === 0) throw new OrderNotFoundError();

        if (changes.items) {
          await tx.orderItem.deleteMany({ where: { orderId: id } });
          await tx.orderItem.createMany({
            data: changes.items.map(({ description, priceCents }) => ({
              orderId: id,
              description,
              priceCents,
            })),
          });
        }
        return tx.order.findUniqueOrThrow({ where: { id }, select: orderDetailSelect });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  /**
   * Conditional on the order still being active, so a concurrent DELETE or PATCH that wins the row
   * lock makes this a no-op instead of resurrecting or re-deleting the record. Rows are never removed.
   */
  async softDeleteActive(id: string): Promise<boolean> {
    const { count } = await this.prisma.order.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date(), cacheRevision: { increment: 1 } },
    });
    return count === 1;
  }

  /** Cheapest possible existence and version check: one indexed row, no items, no payload. */
  async findActiveRevision(id: string): Promise<number | null> {
    const order = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      select: { cacheRevision: true },
    });
    return order?.cacheRevision ?? null;
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type OrderDetailModel,
  type OrderSnapshotModel,
  orderDetailSelect,
  orderSnapshotSelect,
} from './orders.projections.js';
import { type CreateOrderRequest, startOfDayUtc } from './schemas/orders.schemas.js';

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
}

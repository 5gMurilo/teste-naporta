import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { type OrderDetailModel, orderDetailSelect } from './orders.projections.js';
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
}

import { z } from 'zod';
import { OrderStatus } from '../../generated/prisma/enums.js';
import { customerSchema, deliveryAddressSchema } from '../schemas/orders.schemas.js';

const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const instant = z.iso.datetime();
const orderStatus = z.enum(Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]]);

export const orderItemResponseSchema = z
  .strictObject({
    id: z.uuid(),
    description: z.string(),
    priceCents: z.number().int().min(0).max(2_000_000_000),
  })
  .meta({ id: 'OrderItem' });

export const orderResponseSchema = z
  .strictObject({
    id: z.uuid(),
    orderNumber: z.string(),
    status: orderStatus,
    expectedDeliveryDate: civilDate.meta({ example: '2026-11-03' }),
    customer: customerSchema,
    deliveryAddress: deliveryAddressSchema,
    items: z.array(orderItemResponseSchema),
    totalCents: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'Sum of item prices in BRL cents; calculated, not stored.' }),
    createdAt: instant,
    updatedAt: instant,
  })
  .meta({ id: 'OrderResponse' });

export const orderSummaryResponseSchema = z
  .strictObject({
    id: z.uuid(),
    orderNumber: z.string(),
    status: orderStatus,
    expectedDeliveryDate: civilDate,
    customer: customerSchema,
    createdAt: instant,
  })
  .meta({ id: 'OrderSummaryResponse' });

export const listOrdersResponseSchema = z
  .strictObject({
    data: z.array(orderSummaryResponseSchema),
    meta: z.strictObject({
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(0),
    }),
  })
  .meta({ id: 'ListOrdersResponse' });

export type OrderResponse = z.infer<typeof orderResponseSchema>;
export type OrderSummaryResponse = z.infer<typeof orderSummaryResponseSchema>;
export type ListOrdersResponse = z.infer<typeof listOrdersResponseSchema>;

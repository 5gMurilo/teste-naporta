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
  .meta({
    id: 'OrderResponse',
    example: {
      id: '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
      orderNumber: 'NP-2026-0001',
      status: 'PENDING',
      expectedDeliveryDate: '2026-11-03',
      customer: { name: 'Ana Silva', document: '123.456.789-00' },
      deliveryAddress: {
        street: 'Rua das Flores',
        number: '101',
        complement: 'Apto 12',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01001000',
      },
      items: [
        {
          id: '1b4e28ba-2fa1-4d3b-a3fd-27d4f4b9d0a1',
          description: 'Café especial',
          priceCents: 4990,
        },
        { id: '2c5f39cb-3fb2-4e4c-b4ae-38e5a5c0e1b2', description: 'Caneca', priceCents: 0 },
      ],
      totalCents: 4990,
      createdAt: '2026-10-21T12:30:45.123Z',
      updatedAt: '2026-10-21T12:30:45.123Z',
    },
  });

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

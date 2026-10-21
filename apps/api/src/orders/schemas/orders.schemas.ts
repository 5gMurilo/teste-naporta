import { z } from 'zod';
import { OrderStatus } from '../../generated/prisma/enums.js';

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SKIP = 2_147_483_647;

function isRealCivilDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const civilDate = z
  .string()
  .regex(CIVIL_DATE, 'Expected a date in the format YYYY-MM-DD')
  .refine(isRealCivilDate, 'Expected a real calendar date');

/** Start of the given civil day, in UTC. */
export function startOfDayUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Start of the day after the given civil day, in UTC (exclusive upper bound). */
export function startOfNextDayUtc(date: string): Date {
  const next = startOfDayUtc(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

// PostgreSQL text cannot store NUL; reject it as invalid input instead of failing the write.
const noNul = (value: string) => !value.includes('\u0000');
const NUL_MESSAGE = 'Must not contain null characters';

const text = (max: number) => z.string().trim().min(1).max(max).refine(noNul, NUL_MESSAGE);

const orderStatus = z.enum(Object.values(OrderStatus) as [OrderStatus, ...OrderStatus[]]);

export const customerSchema = z
  .strictObject({
    name: text(160).meta({ example: 'Ana Silva' }),
    document: text(32).meta({ description: 'Free-form document; no CPF/CNPJ algorithm.' }),
  })
  .meta({ id: 'Customer' });

export const deliveryAddressSchema = z
  .strictObject({
    street: text(160),
    number: text(20),
    complement: z.string().trim().max(100).refine(noNul, NUL_MESSAGE).optional(),
    neighborhood: text(100),
    city: text(100),
    state: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'Expected two letters')
      .meta({ example: 'SP' }),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{8}$/, 'Expected exactly eight digits')
      .meta({ example: '01001000' }),
  })
  .meta({ id: 'DeliveryAddress' });

const orderItemInputSchema = z
  .strictObject({
    description: text(240).meta({ example: 'Café especial' }),
    priceCents: z
      .number()
      .int()
      .min(0)
      .max(2_000_000_000)
      .meta({ description: 'Price in BRL cents.', example: 4990 }),
  })
  .meta({ id: 'OrderItemInput' });

const itemsSchema = z.array(orderItemInputSchema).min(1).max(50);

const orderNumber = text(64).meta({ example: 'NP-2026-0001' });

export const createOrderRequestSchema = z
  .strictObject({
    orderNumber,
    status: orderStatus.optional().meta({ description: 'Defaults to PENDING.' }),
    expectedDeliveryDate: civilDate.meta({ example: '2026-11-03' }),
    customer: customerSchema,
    deliveryAddress: deliveryAddressSchema,
    items: itemsSchema,
  })
  .meta({
    id: 'CreateOrderRequest',
    example: {
      orderNumber: 'NP-2026-0001',
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
        { description: 'Café especial', priceCents: 4990 },
        { description: 'Caneca', priceCents: 0 },
      ],
    },
  });

export const updateOrderRequestSchema = z
  .strictObject({
    orderNumber: orderNumber.optional(),
    status: orderStatus.optional(),
    expectedDeliveryDate: civilDate.optional(),
    customer: customerSchema.optional(),
    deliveryAddress: deliveryAddressSchema.optional(),
    items: itemsSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'At least one field is required')
  .meta({
    id: 'UpdateOrderRequest',
    example: { status: 'SHIPPED' },
  });

export const orderParamsSchema = z.strictObject({
  id: z
    .uuid()
    .meta({ description: 'Order UUID.', example: '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b' }),
});

const queryInteger = z
  .string()
  .regex(/^\d+$/, 'Expected a positive integer')
  .transform(Number)
  .pipe(z.number().int().min(1));

export const listOrdersQuerySchema = z
  .strictObject({
    orderNumber: text(64).optional(),
    status: orderStatus.optional(),
    createdFrom: civilDate.optional(),
    createdTo: civilDate.optional(),
    page: queryInteger
      .optional()
      .meta({ description: 'Page number, starting at 1. Defaults to 1.', example: '1' }),
    pageSize: queryInteger
      .pipe(z.number().max(100))
      .optional()
      .meta({ description: 'Items per page, 1 to 100. Defaults to 20.', example: '20' }),
  })
  .refine(({ createdFrom, createdTo }) => !createdFrom || !createdTo || createdFrom <= createdTo, {
    message: 'createdFrom must not be after createdTo',
    path: ['createdFrom'],
  })
  .refine(({ page = 1, pageSize = 20 }) => (page - 1) * pageSize <= MAX_SKIP, {
    message: 'Page is out of range',
    path: ['page'],
  })
  .transform(({ createdFrom, createdTo, page = 1, pageSize = 20, ...rest }) => ({
    ...rest,
    createdAtFrom: createdFrom ? startOfDayUtc(createdFrom) : undefined,
    createdAtBefore: createdTo ? startOfNextDayUtc(createdTo) : undefined,
    page,
    pageSize,
  }));

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
export type UpdateOrderRequest = z.infer<typeof updateOrderRequestSchema>;
export type ListOrdersQuery = z.output<typeof listOrdersQuerySchema>;
export type DeliveryAddress = z.infer<typeof deliveryAddressSchema>;

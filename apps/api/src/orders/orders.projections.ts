import type { Prisma } from '../generated/prisma/client.js';

export const orderSummarySelect = {
  id: true,
  orderNumber: true,
  status: true,
  expectedDeliveryDate: true,
  customerName: true,
  customerDocument: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

export const orderDetailSelect = {
  id: true,
  orderNumber: true,
  status: true,
  expectedDeliveryDate: true,
  customerName: true,
  customerDocument: true,
  deliveryAddress: true,
  createdAt: true,
  updatedAt: true,
  items: { select: { id: true, description: true, priceCents: true } },
} satisfies Prisma.OrderSelect;

export type OrderSummaryModel = Prisma.OrderGetPayload<{ select: typeof orderSummarySelect }>;
export type OrderDetailModel = Prisma.OrderGetPayload<{ select: typeof orderDetailSelect }>;

/** Detail plus the internal revision, read in the same snapshot; the revision is never public. */
export const orderSnapshotSelect = {
  ...orderDetailSelect,
  cacheRevision: true,
} satisfies Prisma.OrderSelect;

export type OrderSnapshotModel = Prisma.OrderGetPayload<{ select: typeof orderSnapshotSelect }>;

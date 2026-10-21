import type { OrderDetailModel, OrderSummaryModel } from '../orders.projections.js';
import { deliveryAddressSchema } from '../schemas/orders.schemas.js';
import type { ListOrdersResponse, OrderResponse, OrderSummaryResponse } from './order.responses.js';

/** DATE columns are read at UTC midnight; use UTC parts so the host time zone never shifts the day. */
function civilDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function summary(model: OrderSummaryModel): OrderSummaryResponse {
  return {
    id: model.id,
    orderNumber: model.orderNumber,
    status: model.status,
    expectedDeliveryDate: civilDate(model.expectedDeliveryDate),
    customer: { name: model.customerName, document: model.customerDocument },
    createdAt: model.createdAt.toISOString(),
  };
}

function detail(model: OrderDetailModel): OrderResponse {
  const items = model.items.map(({ id, description, priceCents }) => ({
    id,
    description,
    priceCents,
  }));
  return {
    id: model.id,
    orderNumber: model.orderNumber,
    status: model.status,
    expectedDeliveryDate: civilDate(model.expectedDeliveryDate),
    customer: { name: model.customerName, document: model.customerDocument },
    deliveryAddress: deliveryAddressSchema.parse(model.deliveryAddress),
    items,
    totalCents: items.reduce((total, item) => total + item.priceCents, 0),
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  };
}

function list(
  models: readonly OrderSummaryModel[],
  total: number,
  page: number,
  pageSize: number,
): ListOrdersResponse {
  return {
    data: models.map(summary),
    meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export const OrderPresenter = { detail, summary, list };

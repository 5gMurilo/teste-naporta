/** Public shapes of the API contract that the HTTP layer itself understands (docs/openapi.json). */
export interface FieldError {
  field: string;
  message: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  requestId: string;
  errors?: FieldError[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export const ORDER_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Customer {
  name: string;
  document: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  /** Civil date, YYYY-MM-DD. */
  expectedDeliveryDate: string;
  customer: Customer;
  /** UTC instant, ISO 8601. */
  createdAt: string;
}

export interface ListOrdersResponse {
  data: OrderSummary[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface DeliveryAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface OrderItem {
  id: string;
  description: string;
  priceCents: number;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  expectedDeliveryDate: string;
  customer: Customer;
  deliveryAddress: DeliveryAddress;
  items: OrderItem[];
  totalCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface ItemInput {
  description: string;
  priceCents: number;
}

export interface CreateOrderPayload {
  orderNumber: string;
  status: OrderStatus;
  expectedDeliveryDate: string;
  customer: Customer;
  deliveryAddress: DeliveryAddress;
  items: ItemInput[];
}

/** PATCH body: only what changed; customer, deliveryAddress, and items are always sent whole. */
export type UpdateOrderPayload = Partial<CreateOrderPayload>;

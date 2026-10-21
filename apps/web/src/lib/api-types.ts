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

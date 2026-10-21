import type {
  CreateOrderPayload,
  DeliveryAddress,
  ItemInput,
  OrderDetail,
  OrderStatus,
  UpdateOrderPayload,
} from '@/lib/api-types';

export interface ItemDraft {
  /** Local identity so inputs keep focus while items are added or removed; never sent. */
  key: string;
  description: string;
  /** Text typed by the user, in cents. */
  priceCents: string;
}

export interface OrderFormValues {
  orderNumber: string;
  status: OrderStatus;
  expectedDeliveryDate: string;
  customerName: string;
  customerDocument: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  items: ItemDraft[];
}

export type FormErrors = Partial<Record<Exclude<keyof OrderFormValues, 'items'>, string>> & {
  items?: string;
  itemErrors?: Record<string, { description?: string; priceCents?: string }>;
};

let keyCounter = 0;
export const newItemKey = () => `item-${++keyCounter}`;

export const emptyItem = (): ItemDraft => ({ key: newItemKey(), description: '', priceCents: '' });

export function emptyForm(): OrderFormValues {
  return {
    orderNumber: '',
    status: 'PENDING',
    expectedDeliveryDate: '',
    customerName: '',
    customerDocument: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    postalCode: '',
    items: [emptyItem()],
  };
}

export function fromOrder(order: OrderDetail): OrderFormValues {
  const { deliveryAddress: address } = order;
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    expectedDeliveryDate: order.expectedDeliveryDate,
    customerName: order.customer.name,
    customerDocument: order.customer.document,
    street: address.street,
    number: address.number,
    complement: address.complement ?? '',
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    items: order.items.map((item) => ({
      key: newItemKey(),
      description: item.description,
      priceCents: String(item.priceCents),
    })),
  };
}

/** Whole cents typed as digits. Anything else (decimals, signs, exponents) is not a price. */
export function parseCents(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : undefined;
}

const REQUIRED = 'Campo obrigatório.';

/**
 * Structural checks only (something was typed, prices are whole cents, there is an item). Every
 * business limit stays with the API, whose field errors are shown next to the inputs.
 */
export function validateForm(values: OrderFormValues): FormErrors {
  const errors: FormErrors = {};
  const required = [
    'orderNumber',
    'expectedDeliveryDate',
    'customerName',
    'customerDocument',
    'street',
    'number',
    'neighborhood',
    'city',
    'state',
    'postalCode',
  ] as const;
  for (const field of required) {
    if (values[field].trim() === '') errors[field] = REQUIRED;
  }
  if (values.items.length === 0) errors.items = 'Informe pelo menos um item.';
  const itemErrors: NonNullable<FormErrors['itemErrors']> = {};
  for (const item of values.items) {
    const problems: { description?: string; priceCents?: string } = {};
    if (item.description.trim() === '') problems.description = REQUIRED;
    if (item.priceCents.trim() === '') problems.priceCents = REQUIRED;
    else if (parseCents(item.priceCents) === undefined) {
      problems.priceCents = 'Informe o preço em centavos, apenas números inteiros.';
    }
    if (problems.description || problems.priceCents) itemErrors[item.key] = problems;
  }
  if (Object.keys(itemErrors).length > 0) errors.itemErrors = itemErrors;
  return errors;
}

export const hasErrors = (errors: FormErrors) => Object.keys(errors).length > 0;

function addressOf(values: OrderFormValues): DeliveryAddress {
  const complement = values.complement.trim();
  return {
    street: values.street.trim(),
    number: values.number.trim(),
    ...(complement !== '' && { complement }),
    neighborhood: values.neighborhood.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    postalCode: values.postalCode.trim(),
  };
}

function itemsOf(values: OrderFormValues): ItemInput[] {
  return values.items.map((item) => ({
    description: item.description.trim(),
    priceCents: parseCents(item.priceCents) as number,
  }));
}

const customerOf = (values: OrderFormValues) => ({
  name: values.customerName.trim(),
  document: values.customerDocument.trim(),
});

/** Call only after validateForm succeeded. */
export function toCreatePayload(values: OrderFormValues): CreateOrderPayload {
  return {
    orderNumber: values.orderNumber.trim(),
    status: values.status,
    expectedDeliveryDate: values.expectedDeliveryDate.trim(),
    customer: customerOf(values),
    deliveryAddress: addressOf(values),
    items: itemsOf(values),
  };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Builds the PATCH body from what really changed, or undefined when nothing did (an empty PATCH is
 * invalid). A changed customer, address, or item list is sent whole because the API replaces them
 * as a unit; item ids are never sent.
 */
export function toPatchPayload(
  initial: OrderFormValues,
  current: OrderFormValues,
): UpdateOrderPayload | undefined {
  const payload: UpdateOrderPayload = {};
  const orderNumber = current.orderNumber.trim();
  if (orderNumber !== initial.orderNumber.trim()) payload.orderNumber = orderNumber;
  if (current.status !== initial.status) payload.status = current.status;
  const date = current.expectedDeliveryDate.trim();
  if (date !== initial.expectedDeliveryDate.trim()) payload.expectedDeliveryDate = date;
  if (!sameJson(customerOf(current), customerOf(initial))) payload.customer = customerOf(current);
  if (!sameJson(addressOf(current), addressOf(initial)))
    payload.deliveryAddress = addressOf(current);
  if (!sameJson(itemsOf(current), itemsOf(initial))) payload.items = itemsOf(current);
  return Object.keys(payload).length > 0 ? payload : undefined;
}

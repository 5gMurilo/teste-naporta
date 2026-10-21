import {
  createOrderRequestSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  startOfDayUtc,
  startOfNextDayUtc,
  updateOrderRequestSchema,
} from './orders.schemas.js';

const address = {
  street: 'Rua das Flores',
  number: '101',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  postalCode: '01001000',
};
const validCreate = () => ({
  orderNumber: 'NP-2026-0001',
  expectedDeliveryDate: '2026-11-03',
  customer: { name: 'Ana Silva', document: 'DOC-1' },
  deliveryAddress: { ...address },
  items: [{ description: 'Café', priceCents: 4990 }],
});

describe('createOrderRequestSchema (U08, U09, U10)', () => {
  it('trims text, uppercases state, keeps optional fields absent, and leaves status undefined', () => {
    const parsed = createOrderRequestSchema.parse({
      ...validCreate(),
      orderNumber: '  NP-1  ',
      customer: { name: ' Ana ', document: ' 123 ' },
      deliveryAddress: { ...address, state: ' sp ', complement: '  Apto 2  ' },
    });

    expect(parsed.orderNumber).toBe('NP-1');
    expect(parsed.customer).toEqual({ name: 'Ana', document: '123' });
    expect(parsed.deliveryAddress.state).toBe('SP');
    expect(parsed.deliveryAddress.complement).toBe('Apto 2');
    expect(parsed.status).toBeUndefined();
  });

  it.each([
    ['orderNumber at 64 characters', { orderNumber: 'a'.repeat(64) }],
    ['past delivery date', { expectedDeliveryDate: '2000-01-01' }],
    ['leap day', { expectedDeliveryDate: '2024-02-29' }],
    ['generic non CPF/CNPJ document', { customer: { name: 'A', document: 'x'.repeat(32) } }],
    ['every status', { status: 'DELIVERED' }],
    ['zero priced item', { items: [{ description: 'Free', priceCents: 0 }] }],
    ['maximum price', { items: [{ description: 'Max', priceCents: 2_000_000_000 }] }],
    [
      'fifty items',
      { items: Array.from({ length: 50 }, () => ({ description: 'i', priceCents: 1 })) },
    ],
    ['empty complement', { deliveryAddress: { ...address, complement: '' } }],
    [
      'complement at 100 characters',
      { deliveryAddress: { ...address, complement: 'c'.repeat(100) } },
    ],
  ])('accepts %s', (_name, override) => {
    expect(createOrderRequestSchema.safeParse({ ...validCreate(), ...override }).success).toBe(
      true,
    );
  });

  it.each([
    ['empty orderNumber', { orderNumber: '   ' }],
    ['orderNumber at 65 characters', { orderNumber: 'a'.repeat(65) }],
    ['unknown status', { status: 'LOST' }],
    ['null status', { status: null }],
    ['customer name at 161', { customer: { name: 'n'.repeat(161), document: 'd' } }],
    ['document at 33', { customer: { name: 'n', document: 'd'.repeat(33) } }],
    ['empty document', { customer: { name: 'n', document: ' ' } }],
    ['missing customer', { customer: undefined }],
    ['street at 161', { deliveryAddress: { ...address, street: 's'.repeat(161) } }],
    ['number at 21', { deliveryAddress: { ...address, number: '1'.repeat(21) } }],
    ['complement at 101', { deliveryAddress: { ...address, complement: 'c'.repeat(101) } }],
    ['null complement', { deliveryAddress: { ...address, complement: null } }],
    ['neighborhood at 101', { deliveryAddress: { ...address, neighborhood: 'n'.repeat(101) } }],
    ['city at 101', { deliveryAddress: { ...address, city: 'c'.repeat(101) } }],
    ['one letter state', { deliveryAddress: { ...address, state: 'S' } }],
    ['three letter state', { deliveryAddress: { ...address, state: 'SPA' } }],
    ['numeric state', { deliveryAddress: { ...address, state: 'S1' } }],
    ['accented state', { deliveryAddress: { ...address, state: 'SÃ' } }],
    ['seven digit postal code', { deliveryAddress: { ...address, postalCode: '0100100' } }],
    ['nine digit postal code', { deliveryAddress: { ...address, postalCode: '010010000' } }],
    ['hyphenated postal code', { deliveryAddress: { ...address, postalCode: '01001-000' } }],
    ['unknown address property', { deliveryAddress: { ...address, country: 'BR' } }],
    ['unknown customer property', { customer: { name: 'n', document: 'd', email: 'x' } }],
    ['no items', { items: [] }],
    [
      'fifty one items',
      { items: Array.from({ length: 51 }, () => ({ description: 'i', priceCents: 1 })) },
    ],
    ['null items', { items: null }],
    ['item description at 241', { items: [{ description: 'd'.repeat(241), priceCents: 1 }] }],
    ['negative price', { items: [{ description: 'd', priceCents: -1 }] }],
    ['fractional price', { items: [{ description: 'd', priceCents: 1.5 }] }],
    ['price above maximum', { items: [{ description: 'd', priceCents: 2_000_000_001 }] }],
    ['string price', { items: [{ description: 'd', priceCents: '10' }] }],
    ['item quantity', { items: [{ description: 'd', priceCents: 1, quantity: 2 }] }],
    ['item id', { items: [{ id: 'x', description: 'd', priceCents: 1 }] }],
    ['impossible date', { expectedDeliveryDate: '2026-02-30' }],
    ['non leap day', { expectedDeliveryDate: '2025-02-29' }],
    ['timestamp instead of date', { expectedDeliveryDate: '2026-11-03T00:00:00.000Z' }],
    ['unpadded date', { expectedDeliveryDate: '2026-1-3' }],
    ['empty date', { expectedDeliveryDate: '' }],
    ['unknown top level property', { extra: true }],
    ['private properties', { id: 'x', createdAt: '2026-01-01', updatedAt: 'x', deletedAt: null }],
  ])('rejects %s', (_name, override) => {
    expect(createOrderRequestSchema.safeParse({ ...validCreate(), ...override }).success).toBe(
      false,
    );
  });
});

describe('updateOrderRequestSchema (U13)', () => {
  it.each([
    ['status only', { status: 'PENDING' }],
    ['orderNumber only', { orderNumber: 'NP-9' }],
    ['date only', { expectedDeliveryDate: '2026-12-01' }],
    ['complete customer', { customer: { name: 'n', document: 'd' } }],
    ['address without complement', { deliveryAddress: { ...address } }],
    ['complete items', { items: [{ description: 'd', priceCents: 0 }] }],
  ])('accepts %s and distinguishes omitted items', (_name, body) => {
    const parsed = updateOrderRequestSchema.parse(body);

    expect('items' in parsed).toBe('items' in body);
  });

  it.each([
    ['empty body', {}],
    ['null field', { status: null }],
    ['partial customer', { customer: { name: 'only name' } }],
    ['partial address', { deliveryAddress: { street: 'x' } }],
    ['empty items', { items: [] }],
    ['unknown property', { quantity: 1 }],
    ['private id', { id: '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b' }],
    ['deletedAt', { deletedAt: null }],
  ])('rejects %s', (_name, body) => {
    expect(updateOrderRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe('listOrdersQuerySchema (U11, U12)', () => {
  it('applies page 1 and pageSize 20 and leaves filters undefined', () => {
    expect(listOrdersQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      createdAtFrom: undefined,
      createdAtBefore: undefined,
    });
  });

  it('converts a one day period into an inclusive start and exclusive next day in UTC', () => {
    const parsed = listOrdersQuerySchema.parse({
      createdFrom: '2026-10-21',
      createdTo: '2026-10-21',
    });

    expect(parsed.createdAtFrom?.toISOString()).toBe('2026-10-21T00:00:00.000Z');
    expect(parsed.createdAtBefore?.toISOString()).toBe('2026-10-22T00:00:00.000Z');
  });

  it('rolls month and year boundaries and accepts isolated bounds', () => {
    expect(startOfNextDayUtc('2026-12-31').toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(startOfDayUtc('2026-01-01').toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(
      listOrdersQuerySchema.parse({ createdFrom: '2026-01-01' }).createdAtBefore,
    ).toBeUndefined();
    expect(listOrdersQuerySchema.parse({ createdTo: '2026-01-01' }).createdAtFrom).toBeUndefined();
  });

  it('trims the order number and converts numeric strings explicitly', () => {
    expect(
      listOrdersQuerySchema.parse({
        orderNumber: ' NP-1 ',
        status: 'SHIPPED',
        page: '3',
        pageSize: '100',
      }),
    ).toMatchObject({ orderNumber: 'NP-1', status: 'SHIPPED', page: 3, pageSize: 100 });
    expect(listOrdersQuerySchema.parse({ pageSize: '1' }).pageSize).toBe(1);
  });

  it.each([
    ['page zero', { page: '0' }],
    ['pageSize zero', { pageSize: '0' }],
    ['pageSize 101', { pageSize: '101' }],
    ['empty page', { page: '' }],
    ['fractional page', { page: '1.5' }],
    ['negative page', { page: '-1' }],
    ['spaced page', { page: ' 1' }],
    ['text page', { page: 'abc' }],
    ['exponent page', { page: '1e3' }],
    ['repeated page', { page: ['1', '2'] }],
    ['nested page', { page: { gt: '1' } }],
    ['unknown status', { status: 'LOST' }],
    ['empty status', { status: '' }],
    ['unknown filter', { customerName: 'x' }],
    ['blank order number', { orderNumber: '  ' }],
    ['order number at 65', { orderNumber: 'a'.repeat(65) }],
    ['timestamp createdFrom', { createdFrom: '2026-10-21T00:00:00Z' }],
    ['impossible createdTo', { createdTo: '2026-02-30' }],
    ['inverted period', { createdFrom: '2026-10-22', createdTo: '2026-10-21' }],
    ['skip beyond int range', { page: '2147483647', pageSize: '100' }],
  ])('rejects %s', (_name, query) => {
    expect(listOrdersQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('orderIdParamSchema', () => {
  it('accepts a UUID and rejects everything else', () => {
    expect(orderIdParamSchema.safeParse('6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b').success).toBe(true);
    for (const bad of ['', '123', 'not-a-uuid', '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6']) {
      expect(orderIdParamSchema.safeParse(bad).success).toBe(false);
    }
  });
});

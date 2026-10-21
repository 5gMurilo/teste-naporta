import { describe, expect, it } from 'vitest';
import type { OrderDetail } from '@/lib/api-types';
import {
  emptyForm,
  fromOrder,
  hasErrors,
  newItemKey,
  type OrderFormValues,
  parseCents,
  toCreatePayload,
  toPatchPayload,
  validateForm,
} from './order-form-model';

const order: OrderDetail = {
  id: '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b',
  orderNumber: 'NP-1',
  status: 'PENDING',
  expectedDeliveryDate: '2026-11-03',
  customer: { name: 'Ana Silva', document: 'DOC-1' },
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
    { id: 'id-1', description: 'Café', priceCents: 4990 },
    { id: 'id-2', description: 'Caneca', priceCents: 0 },
  ],
  totalCents: 4990,
  createdAt: '2026-10-21T12:30:45.123Z',
  updatedAt: '2026-10-21T12:30:45.123Z',
};

const filled = (overrides: Partial<OrderFormValues> = {}): OrderFormValues => ({
  ...fromOrder(order),
  ...overrides,
});

describe('createPayload (U32)', () => {
  it('builds the exact contract body: trimmed text, integer cents, no item ids, no extras', () => {
    const form = filled({
      orderNumber: '  NP-9  ',
      customerName: ' Bia ',
      complement: '',
      items: [{ key: newItemKey(), description: ' Chá ', priceCents: ' 0012 ' }],
    });

    expect(toCreatePayload(form)).toEqual({
      orderNumber: 'NP-9',
      status: 'PENDING',
      expectedDeliveryDate: '2026-11-03',
      customer: { name: 'Bia', document: 'DOC-1' },
      deliveryAddress: {
        street: 'Rua das Flores',
        number: '101',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01001000',
      },
      items: [{ description: 'Chá', priceCents: 12 }],
    });
  });

  it('keeps a typed complement and the selected status', () => {
    const payload = toCreatePayload(filled({ status: 'DELIVERED', complement: ' Fundos ' }));

    expect(payload.status).toBe('DELIVERED');
    expect(payload.deliveryAddress.complement).toBe('Fundos');
  });

  it('never sends item ids or local keys', () => {
    const json = JSON.stringify(toCreatePayload(filled()));

    expect(json).not.toMatch(/id-1|id-2|"key"|item-/);
  });
});

describe('parseCents (U32)', () => {
  it.each([
    ['4990', 4990],
    ['0', 0],
    [' 15 ', 15],
    ['2000000000', 2_000_000_000],
  ])('accepts %s', (text, expected) => {
    expect(parseCents(text)).toBe(expected);
  });

  it.each(['', '1.5', '1,5', '-1', '+1', '1e3', '0x10', 'abc', '99999999999999999999', '１２'])(
    'rejects %s',
    (text) => {
      expect(parseCents(text)).toBeUndefined();
    },
  );
});

describe('validateForm (U32)', () => {
  it('flags every required field of an empty form and the empty item', () => {
    const errors = validateForm(emptyForm());

    expect(Object.keys(errors).sort()).toEqual(
      [
        'city',
        'customerDocument',
        'customerName',
        'expectedDeliveryDate',
        'itemErrors',
        'neighborhood',
        'number',
        'orderNumber',
        'postalCode',
        'state',
        'street',
      ].sort(),
    );
    expect(hasErrors(errors)).toBe(true);
  });

  it('accepts a complete form and treats the complement as optional', () => {
    expect(hasErrors(validateForm(filled({ complement: '' })))).toBe(false);
  });

  it('rejects a fractional or negative price in the item that has it', () => {
    const form = filled({
      items: [
        { key: 'a', description: 'ok', priceCents: '10' },
        { key: 'b', description: 'bad', priceCents: '12.5' },
      ],
    });

    const errors = validateForm(form);

    expect(errors.itemErrors).toEqual({
      b: { priceCents: 'Informe o preço em centavos, apenas números inteiros.' },
    });
  });

  it('requires at least one item', () => {
    expect(validateForm(filled({ items: [] })).items).toBe('Informe pelo menos um item.');
  });

  it('does not invent business limits: an over-long name passes the client and is left to the API', () => {
    expect(hasErrors(validateForm(filled({ customerName: 'n'.repeat(500) })))).toBe(false);
  });
});

describe('patch payload (U32)', () => {
  it('returns undefined when nothing changed, even after trimming and a form round trip', () => {
    const initial = fromOrder(order);
    const same = { ...fromOrder(order), orderNumber: ' NP-1 ', customerName: 'Ana Silva ' };

    expect(toPatchPayload(initial, same)).toBeUndefined();
  });

  it('sends only the changed scalars and leaves items, customer, and address out', () => {
    const initial = fromOrder(order);

    expect(toPatchPayload(initial, { ...initial, status: 'SHIPPED' })).toEqual({
      status: 'SHIPPED',
    });
    expect(
      toPatchPayload(initial, {
        ...initial,
        orderNumber: 'NP-2',
        expectedDeliveryDate: '2026-12-01',
      }),
    ).toEqual({ orderNumber: 'NP-2', expectedDeliveryDate: '2026-12-01' });
  });

  it('sends the whole customer when only one of its fields changed', () => {
    const initial = fromOrder(order);

    expect(toPatchPayload(initial, { ...initial, customerDocument: 'NEW' })).toEqual({
      customer: { name: 'Ana Silva', document: 'NEW' },
    });
  });

  it('sends the whole address, and removing the complement omits it so the API drops it', () => {
    const initial = fromOrder(order);

    const payload = toPatchPayload(initial, { ...initial, complement: '' });

    expect(payload).toEqual({
      deliveryAddress: {
        street: 'Rua das Flores',
        number: '101',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01001000',
      },
    });
    expect(payload?.deliveryAddress).not.toHaveProperty('complement');
  });

  it('sends the complete item list without ids when a price, description, count or order changed', () => {
    const initial = fromOrder(order);
    const [first, second] = initial.items as [
      (typeof initial.items)[number],
      (typeof initial.items)[number],
    ];

    const price = toPatchPayload(initial, {
      ...initial,
      items: [{ ...first, priceCents: '5000' }, second],
    });
    const removed = toPatchPayload(initial, { ...initial, items: [first] });
    const swapped = toPatchPayload(initial, { ...initial, items: [second, first] });

    expect(price?.items).toEqual([
      { description: 'Café', priceCents: 5000 },
      { description: 'Caneca', priceCents: 0 },
    ]);
    expect(removed?.items).toEqual([{ description: 'Café', priceCents: 4990 }]);
    expect(swapped?.items).toEqual([
      { description: 'Caneca', priceCents: 0 },
      { description: 'Café', priceCents: 4990 },
    ]);
    expect(JSON.stringify([price, removed, swapped])).not.toMatch(/id-1|id-2|"key"/);
  });

  it.each(['UTC', 'America/Sao_Paulo', 'Pacific/Kiritimati'])(
    'keeps the delivery date as the same text under TZ=%s',
    (zone) => {
      const previous = process.env.TZ;
      process.env.TZ = zone;
      try {
        const initial = fromOrder(order);
        expect(toCreatePayload(initial).expectedDeliveryDate).toBe('2026-11-03');
        expect(toPatchPayload(initial, { ...initial, expectedDeliveryDate: '2026-11-04' })).toEqual(
          {
            expectedDeliveryDate: '2026-11-04',
          },
        );
      } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
      }
    },
  );
});

describe('form construction', () => {
  it('starts empty with PENDING and one blank item with a unique key', () => {
    const first = emptyForm();
    const second = emptyForm();

    expect(first.status).toBe('PENDING');
    expect(first.items).toHaveLength(1);
    expect(first.items[0]?.key).not.toBe(second.items[0]?.key);
  });

  it('copies an order into editable text values without the item ids', () => {
    const form = fromOrder(order);

    expect(form.items.map((item) => [item.description, item.priceCents])).toEqual([
      ['Café', '4990'],
      ['Caneca', '0'],
    ]);
    expect(JSON.stringify(form)).not.toMatch(/id-1|id-2/);
    expect(
      fromOrder({ ...order, deliveryAddress: { ...order.deliveryAddress, complement: undefined } })
        .complement,
    ).toBe('');
  });
});

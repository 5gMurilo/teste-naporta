import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CreateOrderPayload, OrderDetail, UpdateOrderPayload } from '@/lib/api-types';
import { ApiError, NetworkError } from '@/lib/http-client';
import { MESSAGES, OrderForm } from './order-form';

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

async function fillCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Número do pedido'), 'NP-9');
  await user.type(screen.getByLabelText('Previsão de entrega'), '2026-11-03');
  await user.type(screen.getByLabelText('Nome do cliente'), 'Bia');
  await user.type(screen.getByLabelText('Documento do cliente'), 'DOC-9');
  await user.type(screen.getByLabelText('Rua'), 'Rua A');
  await user.type(screen.getByLabelText('Número'), '5');
  await user.type(screen.getByLabelText('Bairro'), 'Centro');
  await user.type(screen.getByLabelText('Cidade'), 'Santos');
  await user.type(screen.getByLabelText('UF'), 'sp');
  await user.type(screen.getByLabelText('CEP'), '11010000');
  await user.type(screen.getByLabelText('Descrição do item 1'), 'Chá');
  await user.type(screen.getByLabelText('Preço do item 1 (centavos)'), '1200');
}

const submitButton = (name: RegExp | string = /Criar pedido|Salvar alterações|Salvando/) =>
  screen.getByRole('button', { name });

const createForm = (onSubmit: (payload: CreateOrderPayload) => Promise<void>) => (
  <OrderForm mode="create" onSubmit={onSubmit} />
);

describe('OrderForm create (U32, U33, U34, U35)', () => {
  it('starts empty with the PENDING status and every group labelled', () => {
    render(createForm(async () => undefined));

    expect(screen.getByLabelText('Status')).toHaveValue('PENDING');
    expect(screen.getByLabelText('Número do pedido')).toHaveValue('');
    for (const group of ['Pedido', 'Cliente', 'Endereço de entrega', 'Itens']) {
      expect(screen.getByRole('group', { name: group })).toBeInTheDocument();
    }
    expect(screen.getByRole('form', { name: 'Novo pedido' })).toBeInTheDocument();
  });

  it('blocks an empty submit with inline errors, focuses the first invalid field, and does not call onSubmit', async () => {
    const onSubmit = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(createForm(onSubmit));

    await user.click(submitButton());

    await waitFor(() => expect(screen.getByLabelText('Número do pedido')).toHaveFocus());
    expect(screen.getByLabelText('Número do pedido')).toHaveAccessibleDescription(
      'Campo obrigatório.',
    );
    expect(screen.getByLabelText('Rua')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Descrição do item 1')).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the exact contract payload for a complete form', async () => {
    const onSubmit = vi.fn(async (_payload: CreateOrderPayload) => undefined);
    const user = userEvent.setup();
    render(createForm(onSubmit));

    await fillCreateForm(user);
    await user.click(submitButton());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      orderNumber: 'NP-9',
      status: 'PENDING',
      expectedDeliveryDate: '2026-11-03',
      customer: { name: 'Bia', document: 'DOC-9' },
      deliveryAddress: {
        street: 'Rua A',
        number: '5',
        neighborhood: 'Centro',
        city: 'Santos',
        state: 'SP',
        postalCode: '11010000',
      },
      items: [{ description: 'Chá', priceCents: 1200 }],
    });
  });

  it('disables the form while saving, ignores repeated submits, and shows progress', async () => {
    let finish: () => void = () => undefined;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(createForm(onSubmit));
    await fillCreateForm(user);

    await user.click(submitButton());
    await waitFor(() => expect(submitButton(/Salvando/)).toBeDisabled());
    await user.click(submitButton(/Salvando/));
    await user.type(screen.getByLabelText('Preço do item 1 (centavos)'), '{Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('form')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Número do pedido')).toBeDisabled();
    finish();
    await waitFor(() => expect(submitButton()).toBeEnabled());
  });

  it('keeps everything typed after a failure, explains it, and lets the user try again', async () => {
    const onSubmit = vi
      .fn<(payload: CreateOrderPayload) => Promise<void>>()
      .mockRejectedValueOnce(new NetworkError())
      .mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(createForm(onSubmit));
    await fillCreateForm(user);

    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível conectar ao servidor',
    );
    expect(screen.getByLabelText('Número do pedido')).toHaveValue('NP-9');
    expect(screen.getByLabelText('Preço do item 1 (centavos)')).toHaveValue('1200');
    await user.click(submitButton());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a conflict on the order number field and keeps the data', async () => {
    const conflict = new ApiError({
      status: 409,
      code: 'ORDER_NUMBER_ALREADY_EXISTS',
      detail: 'x',
    });
    const user = userEvent.setup();
    render(createForm(vi.fn(async () => Promise.reject(conflict))));
    await fillCreateForm(user);

    await user.click(submitButton());

    await waitFor(() =>
      expect(screen.getByLabelText('Número do pedido')).toHaveAccessibleDescription(
        MESSAGES.duplicateNumber,
      ),
    );
    expect(screen.getByLabelText('Número do pedido')).toHaveFocus();
    expect(screen.getByLabelText('Nome do cliente')).toHaveValue('Bia');
  });

  it('spreads API field errors over the matching inputs, including a specific item', async () => {
    const invalid = new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      detail: 'x',
      errors: [
        { field: 'customer.name', message: 'Too big' },
        { field: 'deliveryAddress.state', message: 'Expected two letters' },
        { field: 'items.0.priceCents', message: 'Too big' },
        { field: 'expectedDeliveryDate', message: 'Expected a real calendar date' },
      ],
    });
    const user = userEvent.setup();
    render(createForm(vi.fn(async () => Promise.reject(invalid))));
    await fillCreateForm(user);

    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGES.invalidData);
    expect(screen.getByLabelText('Nome do cliente')).toHaveAccessibleDescription(
      MESSAGES.invalidValue,
    );
    expect(screen.getByLabelText('UF')).toHaveAccessibleDescription(MESSAGES.invalidValue);
    expect(screen.getByLabelText('Preço do item 1 (centavos)')).toHaveAccessibleDescription(
      MESSAGES.invalidValue,
    );
    expect(screen.getByLabelText('Previsão de entrega')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Cidade')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Too big')).toBeNull();
  });

  it('can be driven entirely from the keyboard, starting at the order number', async () => {
    const user = userEvent.setup();
    render(createForm(async () => undefined));

    await user.tab();

    expect(screen.getByLabelText('Número do pedido')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Status')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Previsão de entrega')).toHaveFocus();
  });

  it('offers a cancel action that does nothing else', async () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<OrderForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('OrderForm edit (U32)', () => {
  const editForm = (
    onSubmit: (payload: UpdateOrderPayload) => Promise<void>,
    current: OrderDetail = order,
  ) => <OrderForm mode="edit" initialOrder={current} onSubmit={onSubmit} />;

  it('loads the order into the fields, with the item descriptions and prices as text', () => {
    render(editForm(async () => undefined));

    expect(screen.getByRole('form', { name: 'Editar pedido' })).toBeInTheDocument();
    expect(screen.getByLabelText('Número do pedido')).toHaveValue('NP-1');
    expect(screen.getByLabelText('Status')).toHaveValue('PENDING');
    expect(screen.getByLabelText('Complemento')).toHaveValue('Apto 12');
    expect(screen.getByLabelText('Descrição do item 2')).toHaveValue('Caneca');
    expect(screen.getByLabelText('Preço do item 1 (centavos)')).toHaveValue('4990');
  });

  it('does not send anything when nothing changed and says so', async () => {
    const onSubmit = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(editForm(onSubmit));

    await user.click(submitButton('Salvar alterações'));

    expect(screen.getByRole('status')).toHaveTextContent(MESSAGES.noChanges);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends only the changed status as the PATCH body', async () => {
    const onSubmit = vi.fn(async (_payload: UpdateOrderPayload) => undefined);
    const user = userEvent.setup();
    render(editForm(onSubmit));

    await user.selectOptions(screen.getByLabelText('Status'), 'SHIPPED');
    await user.click(submitButton('Salvar alterações'));

    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ status: 'SHIPPED' });
  });

  it('sends the complete item list, without ids, when one price changes', async () => {
    const onSubmit = vi.fn(async (_payload: UpdateOrderPayload) => undefined);
    const user = userEvent.setup();
    render(editForm(onSubmit));

    await user.clear(screen.getByLabelText('Preço do item 2 (centavos)'));
    await user.type(screen.getByLabelText('Preço do item 2 (centavos)'), '250');
    await user.click(submitButton('Salvar alterações'));

    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      items: [
        { description: 'Café', priceCents: 4990 },
        { description: 'Caneca', priceCents: 250 },
      ],
    });
  });

  it('drops the complement from the whole address when it is emptied', async () => {
    const onSubmit = vi.fn(async (_payload: UpdateOrderPayload) => undefined);
    const user = userEvent.setup();
    render(editForm(onSubmit));

    await user.clear(screen.getByLabelText('Complemento'));
    await user.click(submitButton('Salvar alterações'));

    const address = onSubmit.mock.calls[0]?.[0].deliveryAddress;
    expect(address).toMatchObject({ street: 'Rua das Flores', postalCode: '01001000' });
    expect(address).not.toHaveProperty('complement');
  });

  it('never mixes two orders: another order replaces every value, and a saved version resets the baseline', async () => {
    const other: OrderDetail = {
      ...order,
      id: '7d1c2d43-9c5e-4a54-9d2c-1e5d05ae8b7c',
      orderNumber: 'NP-2',
      customer: { name: 'Carlos', document: 'DOC-2' },
      items: [{ id: 'id-9', description: 'Livro', priceCents: 3990 }],
    };
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    const { rerender } = render(editForm(onSubmit));
    await user.type(screen.getByLabelText('Nome do cliente'), ' extra');

    rerender(editForm(onSubmit, other));

    expect(screen.getByLabelText('Número do pedido')).toHaveValue('NP-2');
    expect(screen.getByLabelText('Nome do cliente')).toHaveValue('Carlos');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByLabelText('Descrição do item 1')).toHaveValue('Livro');

    await user.type(screen.getByLabelText('Nome do cliente'), '!');
    rerender(
      editForm(onSubmit, {
        ...other,
        customer: { name: 'Carlos!', document: 'DOC-2' },
        updatedAt: '2026-10-22T00:00:00.000Z',
      }),
    );
    await user.click(submitButton('Salvar alterações'));

    expect(within(screen.getByRole('form')).getByRole('status')).toHaveTextContent(
      MESSAGES.noChanges,
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

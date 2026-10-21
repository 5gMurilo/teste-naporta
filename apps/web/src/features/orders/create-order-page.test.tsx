import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { OrderDetail } from '@/lib/api-types';
import { json, problem, type Route, renderApp } from '@/test-utils/render-app';
import { MESSAGES } from './order-form';

const CREATED_ID = '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b';
const created: OrderDetail = {
  id: CREATED_ID,
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
  items: [{ id: 'i1', description: 'Chá', priceCents: 1200 }],
  totalCents: 1200,
  createdAt: '2026-10-21T15:30:00.000Z',
  updatedAt: '2026-10-21T15:30:00.000Z',
};

async function fill(user: ReturnType<typeof userEvent.setup>) {
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

const save = () => screen.getByRole('button', { name: /Criar pedido|Salvando/ });
const posts = (calls: { url: URL; init: RequestInit }[]) =>
  calls.filter((call) => call.url.pathname === '/api/v1/orders' && call.init.method === 'POST');

const routesFor = (post: Route): Record<string, Route> => ({
  '/api/v1/orders': (request) =>
    request.init.method === 'POST'
      ? post(request)
      : json({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
  [`/api/v1/orders/${CREATED_ID}`]: () => json(created),
});

describe('CreateOrderPage (WEB-05, WEB-09)', () => {
  it('is reached from the list through the "Novo pedido" action', async () => {
    const app = await renderApp({ path: '/orders', authenticated: true });

    await app.user.click(await screen.findByRole('link', { name: 'Novo pedido' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Novo pedido' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Novo pedido' })).toBeInTheDocument();
  });

  it('posts the exact contract body once and opens the created order', async () => {
    const app = await renderApp({
      path: '/orders/new',
      authenticated: true,
      routes: routesFor(() => json(created, 201)),
    });

    await fill(app.user);
    await app.user.click(save());

    expect(await screen.findByRole('heading', { name: 'Detalhe do pedido' })).toBeInTheDocument();
    expect(await screen.findByText('NP-9')).toBeInTheDocument();
    const [post] = posts(app.calls);
    expect(posts(app.calls)).toHaveLength(1);
    expect(JSON.parse(String(post?.init.body))).toEqual({
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
    const headers = (post?.init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer jwt-test-token');
  });

  it('puts API validation messages next to the right fields and keeps the data', async () => {
    const app = await renderApp({
      path: '/orders/new',
      authenticated: true,
      routes: routesFor(() =>
        problem(400, 'VALIDATION_ERROR', {
          errors: [
            { field: 'deliveryAddress.postalCode', message: 'Expected exactly eight digits' },
            { field: 'items.0.description', message: 'Too big' },
          ],
        }),
      ),
    });
    await fill(app.user);

    await app.user.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGES.invalidData);
    expect(screen.getByLabelText('CEP')).toHaveAccessibleDescription(MESSAGES.invalidValue);
    expect(screen.getByLabelText('Descrição do item 1')).toHaveAccessibleDescription(
      MESSAGES.invalidValue,
    );
    expect(screen.getByLabelText('Nome do cliente')).toHaveValue('Bia');
    expect(screen.queryByRole('heading', { name: 'Detalhe do pedido' })).toBeNull();
  });

  it('reports a duplicated number on that field (409) without losing the form', async () => {
    const app = await renderApp({
      path: '/orders/new',
      authenticated: true,
      routes: routesFor(() => problem(409, 'ORDER_NUMBER_ALREADY_EXISTS')),
    });
    await fill(app.user);

    await app.user.click(save());

    await waitFor(() =>
      expect(screen.getByLabelText('Número do pedido')).toHaveAccessibleDescription(
        MESSAGES.duplicateNumber,
      ),
    );
    expect(screen.getByLabelText('Preço do item 1 (centavos)')).toHaveValue('1200');
  });

  it('never retries a POST after a network failure; only the user can send it again', async () => {
    let online = false;
    const app = await renderApp({
      path: '/orders/new',
      authenticated: true,
      routes: routesFor(() => {
        if (!online) throw new TypeError('Failed to fetch');
        return json(created, 201);
      }),
    });
    await fill(app.user);

    await app.user.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível conectar ao servidor',
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(posts(app.calls)).toHaveLength(1);

    online = true;
    await app.user.click(save());
    expect(await screen.findByRole('heading', { name: 'Detalhe do pedido' })).toBeInTheDocument();
    expect(posts(app.calls)).toHaveLength(2);
  });

  it('sends a single POST when the button is clicked repeatedly while pending', async () => {
    let finish: (response: Response) => void = () => undefined;
    const app = await renderApp({
      path: '/orders/new',
      authenticated: true,
      routes: routesFor(() => new Promise<Response>((resolve) => (finish = resolve))),
    });
    await fill(app.user);

    await app.user.click(save());
    await app.user.click(save());
    await app.user.dblClick(save());

    expect(posts(app.calls)).toHaveLength(1);
    finish(json(created, 201));
    expect(await screen.findByRole('heading', { name: 'Detalhe do pedido' })).toBeInTheDocument();
  });

  it('cancels back to the list without sending anything', async () => {
    const app = await renderApp({ path: '/orders/new', authenticated: true });

    await app.user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Pedidos' })).toBeInTheDocument();
    expect(posts(app.calls)).toHaveLength(0);
  });
});

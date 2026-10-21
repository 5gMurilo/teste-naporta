import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OrderDetail } from '@/lib/api-types';
import { json, problem, type Route, renderApp } from '@/test-utils/render-app';
import { MESSAGES } from './order-form';

const ID = '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b';
const stored: OrderDetail = {
  id: ID,
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
    { id: 'i1', description: 'Café', priceCents: 4990 },
    { id: 'i2', description: 'Caneca', priceCents: 0 },
  ],
  totalCents: 4990,
  createdAt: '2026-10-21T15:30:00.000Z',
  updatedAt: '2026-10-21T15:30:00.000Z',
};

/** In-memory API: GET returns the current order, PATCH merges the body and answers 200. */
function orderApi(patch?: Route) {
  let current = stored;
  const route: Route = (request) => {
    if (request.init.method === 'PATCH') {
      if (patch) return patch(request);
      current = {
        ...current,
        ...JSON.parse(String(request.init.body)),
        updatedAt: '2026-10-22T10:00:00.000Z',
      };
      return json(current);
    }
    return json(current);
  };
  return { [`/api/v1/orders/${ID}`]: route } as Record<string, Route>;
}

const patchCalls = (calls: { url: URL; init: RequestInit }[]) =>
  calls.filter((call) => call.init.method === 'PATCH');
const getCalls = (calls: { url: URL; init: RequestInit }[]) =>
  calls.filter(
    (call) => call.url.pathname === `/api/v1/orders/${ID}` && call.init.method === 'GET',
  );
const save = () => screen.getByRole('button', { name: /Salvar alterações|Salvando/ });

describe('EditOrderPage (WEB-07, WEB-09)', () => {
  it('is reached from the detail page and loads the order into the form', async () => {
    const app = await renderApp({ path: `/orders/${ID}`, authenticated: true, routes: orderApi() });

    await app.user.click(await screen.findByRole('link', { name: 'Editar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Editar pedido' }),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText('Número do pedido')).toHaveValue('NP-1');
    expect(screen.getByLabelText('Nome do cliente')).toHaveValue('Ana Silva');
    expect(screen.getByLabelText('Descrição do item 2')).toHaveValue('Caneca');
  });

  it('sends nothing, and says so, when no field changed', async () => {
    const app = await renderApp({
      path: `/orders/${ID}/edit`,
      authenticated: true,
      routes: orderApi(),
    });
    await screen.findByLabelText('Número do pedido');

    await app.user.click(save());

    expect(screen.getByRole('status')).toHaveTextContent(MESSAGES.noChanges);
    expect(patchCalls(app.calls)).toHaveLength(0);
  });

  it('sends only the changed status, omitting the items, then shows the confirmed order', async () => {
    const app = await renderApp({
      path: `/orders/${ID}/edit`,
      authenticated: true,
      routes: orderApi(),
    });
    await screen.findByLabelText('Número do pedido');

    await app.user.selectOptions(screen.getByLabelText('Status'), 'DELIVERED');
    await app.user.click(save());

    expect(await screen.findByRole('heading', { name: 'Detalhe do pedido' })).toBeInTheDocument();
    expect(await screen.findByText('Entregue')).toBeInTheDocument();
    const [patch] = patchCalls(app.calls);
    expect(JSON.parse(String(patch?.init.body))).toEqual({ status: 'DELIVERED' });
    expect(getCalls(app.calls).length).toBeGreaterThanOrEqual(2);
  });

  it('replaces the whole item list, without ids, when one item changes, and leaves scalars out', async () => {
    const app = await renderApp({
      path: `/orders/${ID}/edit`,
      authenticated: true,
      routes: orderApi(),
    });
    await screen.findByLabelText('Número do pedido');

    await app.user.clear(screen.getByLabelText('Descrição do item 1'));
    await app.user.type(screen.getByLabelText('Descrição do item 1'), 'Café torrado');
    await app.user.click(screen.getByRole('button', { name: 'Remover item 2' }));
    await app.user.click(save());

    await screen.findByRole('heading', { name: 'Detalhe do pedido' });
    const [patch] = patchCalls(app.calls);
    expect(JSON.parse(String(patch?.init.body))).toEqual({
      items: [{ description: 'Café torrado', priceCents: 4990 }],
    });
    expect(String(patch?.init.body)).not.toMatch(/i1|i2|"id"/);
  });

  it('sends the whole address without the complement when it is cleared', async () => {
    const app = await renderApp({
      path: `/orders/${ID}/edit`,
      authenticated: true,
      routes: orderApi(),
    });
    await screen.findByLabelText('Número do pedido');

    await app.user.clear(screen.getByLabelText('Complemento'));
    await app.user.click(save());

    await screen.findByRole('heading', { name: 'Detalhe do pedido' });
    const body = JSON.parse(String(patchCalls(app.calls)[0]?.init.body));
    expect(Object.keys(body)).toEqual(['deliveryAddress']);
    expect(body.deliveryAddress).not.toHaveProperty('complement');
    expect(body.deliveryAddress.street).toBe('Rua das Flores');
  });

  it('keeps the form and marks the number field when the new number is taken (409)', async () => {
    const app = await renderApp({
      path: `/orders/${ID}/edit`,
      authenticated: true,
      routes: orderApi(() => problem(409, 'ORDER_NUMBER_ALREADY_EXISTS')),
    });
    await screen.findByLabelText('Número do pedido');

    await app.user.clear(screen.getByLabelText('Número do pedido'));
    await app.user.type(screen.getByLabelText('Número do pedido'), 'NP-TAKEN');
    await app.user.click(save());

    await waitFor(() =>
      expect(screen.getByLabelText('Número do pedido')).toHaveAccessibleDescription(
        MESSAGES.duplicateNumber,
      ),
    );
    expect(screen.getByRole('heading', { name: 'Editar pedido' })).toBeInTheDocument();
  });

  it('shows a 400 on the right field and never pretends the order was saved', async () => {
    const app = await renderApp({
      path: `/orders/${ID}/edit`,
      authenticated: true,
      routes: orderApi(() =>
        problem(400, 'VALIDATION_ERROR', {
          errors: [{ field: 'customer.name', message: 'Too big' }],
        }),
      ),
    });
    await screen.findByLabelText('Número do pedido');

    await app.user.type(screen.getByLabelText('Nome do cliente'), ' Souza');
    await app.user.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent(MESSAGES.invalidData);
    expect(screen.getByLabelText('Nome do cliente')).toHaveAccessibleDescription(
      MESSAGES.invalidValue,
    );
    expect(screen.queryByRole('heading', { name: 'Detalhe do pedido' })).toBeNull();
  });

  it('reports a vanished order (404 on save) as an error and stays on the form', async () => {
    const app = await renderApp({
      path: `/orders/${ID}/edit`,
      authenticated: true,
      routes: orderApi(() => problem(404, 'ORDER_NOT_FOUND')),
    });
    await screen.findByLabelText('Número do pedido');

    await app.user.selectOptions(screen.getByLabelText('Status'), 'SHIPPED');
    await app.user.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent('Pedido não encontrado.');
    expect(screen.getByLabelText('Status')).toHaveValue('SHIPPED');
  });

  it('keeps the edits after a network failure and sends a single PATCH per attempt', async () => {
    let online = false;
    const app = await renderApp({
      path: `/orders/${ID}/edit`,
      authenticated: true,
      routes: orderApi(() => {
        if (!online) throw new TypeError('Failed to fetch');
        return json({ ...stored, status: 'SHIPPED' });
      }),
    });
    await screen.findByLabelText('Número do pedido');
    await app.user.selectOptions(screen.getByLabelText('Status'), 'SHIPPED');

    await app.user.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível conectar ao servidor',
    );
    expect(patchCalls(app.calls)).toHaveLength(1);
    online = true;
    await app.user.click(save());

    expect(await screen.findByRole('heading', { name: 'Detalhe do pedido' })).toBeInTheDocument();
    expect(patchCalls(app.calls)).toHaveLength(2);
  });

  it('explains a missing order on load without showing a form, and recovers from a load failure', async () => {
    const missing = await renderApp({
      path: `/orders/${ID}/edit`,
      authenticated: true,
      routes: { [`/api/v1/orders/${ID}`]: () => problem(404, 'ORDER_NOT_FOUND') },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Pedido não encontrado.');
    expect(screen.queryByRole('form')).toBeNull();
    missing.unmount();

    let failing = true;
    const flaky = await renderApp({
      path: `/orders/${ID}/edit`,
      authenticated: true,
      routes: {
        [`/api/v1/orders/${ID}`]: () =>
          failing ? problem(503, 'SERVICE_UNAVAILABLE') : json(stored),
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('temporariamente indisponível');
    failing = false;
    await flaky.user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByLabelText('Número do pedido')).toHaveValue('NP-1');
  });

  it('cancels back to the order without sending anything', async () => {
    const app = await renderApp({
      path: `/orders/${ID}/edit`,
      authenticated: true,
      routes: orderApi(),
    });
    await screen.findByLabelText('Número do pedido');

    await app.user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('heading', { name: 'Detalhe do pedido' })).toBeInTheDocument();
    expect(patchCalls(app.calls)).toHaveLength(0);
  });
});

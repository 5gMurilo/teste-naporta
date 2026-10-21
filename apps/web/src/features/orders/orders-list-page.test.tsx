import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ListOrdersResponse, OrderSummary } from '@/lib/api-types';
import { emptyList, json, problem, type Route, renderApp } from '@/test-utils/render-app';
import { RANGE_ERROR } from './orders-filters';

const order = (n: number, overrides: Partial<OrderSummary> = {}): OrderSummary => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  orderNumber: `NP-${n}`,
  status: 'PENDING',
  expectedDeliveryDate: '2026-11-03',
  customer: { name: `Cliente ${n}`, document: `DOC-${n}` },
  createdAt: '2026-10-21T15:30:00.000Z',
  ...overrides,
});

const page = (
  data: OrderSummary[],
  meta: Partial<ListOrdersResponse['meta']> = {},
): ListOrdersResponse => ({
  data,
  meta: { page: 1, pageSize: 20, total: data.length, totalPages: data.length ? 1 : 0, ...meta },
});

const listRoute =
  (respond: (query: URLSearchParams) => ListOrdersResponse | Response | Promise<Response>): Route =>
  ({ url }) => {
    const result = respond(url.searchParams);
    return result instanceof Response || result instanceof Promise ? result : json(result);
  };

const orderCalls = (calls: { url: URL }[]) =>
  calls.filter((call) => call.url.pathname === '/api/v1/orders');
const lastQuery = (calls: { url: URL }[]) =>
  Object.fromEntries(orderCalls(calls).at(-1)?.url.searchParams ?? []);

describe('OrdersListPage (U31, U33, U35)', () => {
  it('requests page 1 with the default size and renders the summaries without extra requests per row', async () => {
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: {
        '/api/v1/orders': listRoute(() => page([order(1), order(2, { status: 'SHIPPED' })])),
      },
    });

    const table = await screen.findByRole('table');
    expect(lastQuery(app.calls)).toEqual({ page: '1', pageSize: '20' });
    expect(within(table).getByText('NP-1')).toBeInTheDocument();
    expect(within(table).getByText('Enviado')).toBeInTheDocument();
    expect(within(table).getByText('Cliente 2')).toBeInTheDocument();
    expect(
      app.calls.filter((call) => call.url.pathname.startsWith('/api/v1/orders/')),
    ).toHaveLength(0);
  });

  it('shows the civil delivery date as written, without time zone shifting', async () => {
    await renderApp({
      path: '/orders',
      authenticated: true,
      routes: {
        '/api/v1/orders': listRoute(() => page([order(1, { expectedDeliveryDate: '2026-11-01' })])),
      },
    });

    expect(await screen.findByText('01/11/2026')).toBeInTheDocument();
  });

  it('sends exactly the chosen filters, goes back to page 1, and omits empty ones', async () => {
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: { '/api/v1/orders': listRoute(() => page([order(1)], { totalPages: 3, total: 50 })) },
    });
    await screen.findByRole('table');
    await app.user.click(screen.getByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(lastQuery(app.calls).page).toBe('2'));

    await app.user.type(screen.getByLabelText('Número do pedido'), 'NP-1');
    await app.user.selectOptions(screen.getByLabelText('Status'), 'SHIPPED');
    await app.user.type(screen.getByLabelText('Criado a partir de'), '2026-10-01');
    await app.user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() =>
      expect(lastQuery(app.calls)).toEqual({
        orderNumber: 'NP-1',
        status: 'SHIPPED',
        createdFrom: '2026-10-01',
        page: '1',
        pageSize: '20',
      }),
    );
  });

  it('clears the filters and reloads the unfiltered first page', async () => {
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: { '/api/v1/orders': listRoute(() => page([order(1)])) },
    });
    await screen.findByRole('table');
    await app.user.type(screen.getByLabelText('Número do pedido'), 'NP-9');
    await app.user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await waitFor(() => expect(lastQuery(app.calls).orderNumber).toBe('NP-9'));

    await app.user.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    await waitFor(() => expect(lastQuery(app.calls)).toEqual({ page: '1', pageSize: '20' }));
    expect(screen.getByLabelText('Número do pedido')).toHaveValue('');
  });

  it('navigates pages with the API meta and disables the buttons at the ends', async () => {
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: {
        '/api/v1/orders': listRoute((query) => {
          const current = Number(query.get('page'));
          return page([order(current)], { page: current, total: 41, totalPages: 3 });
        }),
      },
    });
    await screen.findByRole('table');
    const previous = () => screen.getByRole('button', { name: 'Anterior' });
    const next = () => screen.getByRole('button', { name: 'Próxima' });

    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();
    expect(screen.getByText(/41 pedido/)).toBeInTheDocument();
    expect(previous()).toBeDisabled();
    await app.user.click(next());
    expect(await screen.findByText('NP-2')).toBeInTheDocument();
    await app.user.click(next());
    expect(await screen.findByText('NP-3')).toBeInTheDocument();
    expect(next()).toBeDisabled();
    await app.user.click(previous());
    expect(await screen.findByText('NP-2')).toBeInTheDocument();
  });

  it('shows the empty message, not an error, when nothing matches', async () => {
    await renderApp({
      path: '/orders',
      authenticated: true,
      routes: { '/api/v1/orders': emptyList },
    });

    expect(await screen.findByText('Nenhum pedido encontrado.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows a safe error with retry and recovers on the second attempt', async () => {
    let failing = true;
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: {
        '/api/v1/orders': (request) =>
          failing
            ? problem(503, 'SERVICE_UNAVAILABLE')
            : listRoute(() => page([order(1)]))(request),
      },
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('temporariamente indisponível');
    failing = false;
    await app.user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('NP-1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(orderCalls(app.calls)).toHaveLength(2);
  });

  it('ignores a slow response that arrives after a newer one (stale response race)', async () => {
    let releaseSlow: (response: Response) => void = () => undefined;
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: {
        '/api/v1/orders': ({ url }) =>
          url.searchParams.get('orderNumber') === 'SLOW'
            ? new Promise<Response>((resolve) => (releaseSlow = resolve))
            : json(page([order(2, { orderNumber: 'FAST' })])),
      },
    });
    await screen.findByText('FAST');

    await app.user.type(screen.getByLabelText('Número do pedido'), 'SLOW');
    await app.user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    await app.user.clear(screen.getByLabelText('Número do pedido'));
    await app.user.type(screen.getByLabelText('Número do pedido'), 'OTHER');
    await app.user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
    expect(await screen.findByText('FAST')).toBeInTheDocument();
    await act(async () => releaseSlow(json(page([order(9, { orderNumber: 'STALE' })]))));

    expect(screen.queryByText('STALE')).toBeNull();
    expect(screen.getByText('FAST')).toBeInTheDocument();
  });

  it('refuses an inverted period on the client and keeps the current results', async () => {
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: { '/api/v1/orders': listRoute(() => page([order(1)])) },
    });
    await screen.findByRole('table');
    const before = orderCalls(app.calls).length;

    await app.user.type(screen.getByLabelText('Criado a partir de'), '2026-10-22');
    await app.user.type(screen.getByLabelText('Criado até'), '2026-10-21');
    await app.user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    expect(screen.getByRole('alert')).toHaveTextContent(RANGE_ERROR);
    expect(screen.getByLabelText('Criado até')).toHaveAccessibleDescription(RANGE_ERROR);
    expect(orderCalls(app.calls)).toHaveLength(before);
    expect(screen.getByText('NP-1')).toBeInTheDocument();
  });

  it('offers every status with its Portuguese label', async () => {
    await renderApp({ path: '/orders', authenticated: true });
    await screen.findByText('Nenhum pedido encontrado.');

    const labels = within(screen.getByLabelText('Status'))
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(labels).toEqual([
      'Todos',
      'Pendente',
      'Em processamento',
      'Enviado',
      'Entregue',
      'Cancelado',
    ]);
  });
});

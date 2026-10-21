import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ListOrdersResponse, OrderDetail } from '@/lib/api-types';
import { json, problem, type Route, renderApp } from '@/test-utils/render-app';

const ID = '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b';
const detail = (overrides: Partial<OrderDetail> = {}): OrderDetail => ({
  id: ID,
  orderNumber: 'NP-2026-0001',
  status: 'SHIPPED',
  expectedDeliveryDate: '2026-11-03',
  customer: { name: 'Ana Silva', document: '123.456.789-00' },
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
    { id: 'i1', description: 'Café especial', priceCents: 4990 },
    { id: 'i2', description: 'Caneca', priceCents: 0 },
  ],
  totalCents: 4990,
  createdAt: '2026-10-21T15:30:00.000Z',
  updatedAt: '2026-10-22T09:00:00.000Z',
  ...overrides,
});

const detailRoute = (
  order: OrderDetail | (() => Response | Promise<Response>),
): Record<string, Route> => ({
  [`/api/v1/orders/${ID}`]: typeof order === 'function' ? order : () => json(order),
});

describe('OrderDetailPage (U35)', () => {
  it('shows every public field with the total in BRL and the delivery date as written', async () => {
    await renderApp({ path: `/orders/${ID}`, authenticated: true, routes: detailRoute(detail()) });

    expect(await screen.findByText('NP-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Enviado')).toBeInTheDocument();
    expect(screen.getByText('03/11/2026')).toBeInTheDocument();
    expect(screen.getByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText('123.456.789-00')).toBeInTheDocument();
    const address = screen.getByText(/Rua das Flores, 101 - Apto 12/);
    expect(address.closest('address')).toHaveTextContent('Centro · São Paulo/SP · CEP 01001000');
    const table = screen.getByRole('table');
    expect(within(table).getByText('Café especial')).toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /Café especial/ })).toHaveTextContent('R$ 49,90');
    expect(within(table).getByRole('row', { name: /Caneca/ })).toHaveTextContent('R$ 0,00');
    expect(within(table).getByRole('row', { name: /Total/ })).toHaveTextContent('R$ 49,90');
  });

  it('shows the maximum total, 100000000000 cents, without losing a cent', async () => {
    await renderApp({
      path: `/orders/${ID}`,
      authenticated: true,
      routes: detailRoute(detail({ totalCents: 100_000_000_000 })),
    });

    expect(await screen.findByText('R$ 1.000.000.000,00')).toBeInTheDocument();
  });

  it('renders only public fields: internal metadata in the payload never reaches the page', async () => {
    const leaky = { ...detail(), cacheRevision: 42, deletedAt: null, passwordHash: 'hash-xyz' };
    await renderApp({ path: `/orders/${ID}`, authenticated: true, routes: detailRoute(leaky) });

    await screen.findByText('NP-2026-0001');

    expect(document.body.textContent).not.toMatch(
      /cacheRevision|deletedAt|passwordHash|hash-xyz|42/,
    );
  });

  it('explains a missing order without a retry button and links back to the list', async () => {
    await renderApp({
      path: `/orders/${ID}`,
      authenticated: true,
      routes: detailRoute(() => problem(404, 'ORDER_NOT_FOUND')),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Pedido não encontrado.');
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Voltar para a lista' })).toHaveAttribute(
      'href',
      '/orders',
    );
  });

  it('shows a loading status, then recovers from a failure with the retry button', async () => {
    let failing = true;
    const app = await renderApp({
      path: `/orders/${ID}`,
      authenticated: true,
      routes: detailRoute(() => (failing ? problem(503, 'SERVICE_UNAVAILABLE') : json(detail()))),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('temporariamente indisponível');
    failing = false;
    await app.user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('NP-2026-0001')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ignores a slow response for a previous order when the route changes', async () => {
    const OTHER = '7d1c2d43-9c5e-4a54-9d2c-1e5d05ae8b7c';
    let releaseSlow: (response: Response) => void = () => undefined;
    const app = await renderApp({
      path: `/orders/${ID}`,
      authenticated: true,
      routes: {
        [`/api/v1/orders/${ID}`]: () => new Promise<Response>((resolve) => (releaseSlow = resolve)),
        [`/api/v1/orders/${OTHER}`]: () => json(detail({ id: OTHER, orderNumber: 'NP-OTHER' })),
      },
    });

    await app.navigate(`/orders/${OTHER}`);
    expect(await screen.findByText('NP-OTHER')).toBeInTheDocument();
    await act(async () => releaseSlow(json(detail({ orderNumber: 'NP-STALE' }))));

    expect(screen.queryByText('NP-STALE')).toBeNull();
    expect(screen.getByText('NP-OTHER')).toBeInTheDocument();
  });

  it('opens from the list through a real link to the order', async () => {
    const list: ListOrdersResponse = {
      data: [
        {
          id: ID,
          orderNumber: 'NP-2026-0001',
          status: 'PENDING',
          expectedDeliveryDate: '2026-11-03',
          customer: { name: 'Ana Silva', document: 'x' },
          createdAt: '2026-10-21T15:30:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: { '/api/v1/orders': () => json(list), ...detailRoute(detail()) },
    });

    await app.user.click(await screen.findByRole('link', { name: 'NP-2026-0001' }));

    expect(await screen.findByRole('heading', { name: 'Detalhe do pedido' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Café especial')).toBeInTheDocument());
  });

  it('keeps the delivery date identical under another time zone', async () => {
    const previous = process.env.TZ;
    process.env.TZ = 'Pacific/Kiritimati';
    try {
      await renderApp({
        path: `/orders/${ID}`,
        authenticated: true,
        routes: detailRoute(detail()),
      });

      expect(await screen.findByText('03/11/2026')).toBeInTheDocument();
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});

import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ListOrdersResponse, OrderSummary } from '@/lib/api-types';
import { json, problem, type Route, renderApp } from '@/test-utils/render-app';

const summary = (n: number): OrderSummary => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  orderNumber: `NP-${n}`,
  status: 'PENDING',
  expectedDeliveryDate: '2026-11-03',
  customer: { name: `Cliente ${n}`, document: `D${n}` },
  createdAt: '2026-10-21T15:30:00.000Z',
});

/** A fake orders API that really removes the order on DELETE and paginates its current content. */
function ordersApi(initial: number[], options: { onDelete?: Route; pageSize?: number } = {}) {
  let present = [...initial];
  const pageSize = options.pageSize ?? 20;
  const list: Route = ({ url }) => {
    const page = Number(url.searchParams.get('page') ?? 1);
    const slice = present.slice((page - 1) * pageSize, page * pageSize);
    const body: ListOrdersResponse = {
      data: slice.map(summary),
      meta: {
        page,
        pageSize,
        total: present.length,
        totalPages: Math.ceil(present.length / pageSize),
      },
    };
    return json(body);
  };
  const routes: Record<string, Route> = { '/api/v1/orders': list };
  for (const n of initial) {
    const id = summary(n).id;
    routes[`/api/v1/orders/${id}`] = (request) => {
      if (request.init.method === 'DELETE') {
        if (options.onDelete) return options.onDelete(request);
        present = present.filter((value) => value !== n);
        return new Response(null, { status: 204 });
      }
      return json({
        ...summary(n),
        items: [],
        deliveryAddress: {},
        totalCents: 0,
        updatedAt: summary(n).createdAt,
      });
    };
  }
  return routes;
}

const deletes = (calls: { url: URL; init: RequestInit }[]) =>
  calls.filter((call) => call.init.method === 'DELETE');
const trigger = (n: number) => screen.getByRole('button', { name: `Excluir pedido NP-${n}` });

describe('DeleteOrderDialog (U34, U35)', () => {
  it('asks for confirmation with an accessible title and description, focusing the safe action', async () => {
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: ordersApi([1, 2]),
    });
    await screen.findByText('NP-1');

    await app.user.click(trigger(1));

    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir o pedido NP-1?' });
    expect(dialog).toHaveAccessibleDescription(/continua reservado/);
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(deletes(app.calls)).toHaveLength(0);
  });

  it('cancel closes the dialog without calling the API and returns focus to the trigger', async () => {
    const app = await renderApp({ path: '/orders', authenticated: true, routes: ordersApi([1]) });
    await screen.findByText('NP-1');
    await app.user.click(trigger(1));

    await app.user.click(await screen.findByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(deletes(app.calls)).toHaveLength(0);
    expect(trigger(1)).toHaveFocus();
    expect(screen.getByText('NP-1')).toBeInTheDocument();
  });

  it('Escape also cancels without deleting', async () => {
    const app = await renderApp({ path: '/orders', authenticated: true, routes: ordersApi([1]) });
    await screen.findByText('NP-1');
    await app.user.click(trigger(1));
    await screen.findByRole('alertdialog');

    await app.user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(deletes(app.calls)).toHaveLength(0);
  });

  it('waits for the 204 before closing and refreshing, blocks double clicks, and cannot be dismissed meanwhile', async () => {
    let finish: (response: Response) => void = () => undefined;
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: ordersApi([1, 2], {
        onDelete: () => new Promise<Response>((resolve) => (finish = resolve)),
      }),
    });
    await screen.findByText('NP-1');
    await app.user.click(trigger(1));
    const confirm = await screen.findByRole('button', { name: 'Excluir pedido' });

    await app.user.click(confirm);
    await app.user.click(screen.getByRole('button', { name: 'Excluindo…' }));
    await app.user.keyboard('{Escape}');

    expect(deletes(app.calls)).toHaveLength(1);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByText('NP-1')).toBeInTheDocument();
    await act(async () => finish(new Response(null, { status: 204 })));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('removes the order from the list after the 204 and moves focus to the page title', async () => {
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: ordersApi([1, 2]),
    });
    await screen.findByText('NP-1');
    await app.user.click(trigger(1));

    await app.user.click(await screen.findByRole('button', { name: 'Excluir pedido' }));

    await waitFor(() => expect(screen.queryByText('NP-1')).toBeNull());
    expect(screen.getByText('NP-2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Pedidos' })).toHaveFocus();
  });

  it('goes back to the previous page when the last order of a later page is deleted', async () => {
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: ordersApi([1, 2, 3], { pageSize: 2 }),
    });
    await screen.findByText('NP-1');
    await app.user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(await screen.findByText('NP-3')).toBeInTheDocument();
    expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument();

    await app.user.click(trigger(3));
    await app.user.click(await screen.findByRole('button', { name: 'Excluir pedido' }));

    expect(await screen.findByText(/Página 1 de 1/)).toBeInTheDocument();
    expect(screen.getByText('NP-1')).toBeInTheDocument();
    expect(screen.getByText('NP-2')).toBeInTheDocument();
    expect(screen.queryByText('NP-3')).toBeNull();
  });

  it('shows the empty state after deleting the only order', async () => {
    const app = await renderApp({ path: '/orders', authenticated: true, routes: ordersApi([1]) });
    await screen.findByText('NP-1');
    await app.user.click(trigger(1));

    await app.user.click(await screen.findByRole('button', { name: 'Excluir pedido' }));

    expect(await screen.findByText('Nenhum pedido encontrado.')).toBeInTheDocument();
  });

  it('keeps the dialog open with the reason on a network failure and allows trying again', async () => {
    let online = false;
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: ordersApi([1], {
        onDelete: () => {
          if (!online) throw new TypeError('Failed to fetch');
          return new Response(null, { status: 204 });
        },
      }),
    });
    await screen.findByText('NP-1');
    await app.user.click(trigger(1));
    await app.user.click(await screen.findByRole('button', { name: 'Excluir pedido' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível conectar ao servidor',
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(deletes(app.calls)).toHaveLength(1);

    online = true;
    await app.user.click(screen.getByRole('button', { name: 'Excluir pedido' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(deletes(app.calls)).toHaveLength(2);
  });

  it('reports an order that was already deleted (404) instead of pretending success', async () => {
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: ordersApi([1], { onDelete: () => problem(404, 'ORDER_NOT_FOUND') }),
    });
    await screen.findByText('NP-1');
    await app.user.click(trigger(1));

    await app.user.click(await screen.findByRole('button', { name: 'Excluir pedido' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Pedido não encontrado.');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('deletes from the detail page and returns to the list', async () => {
    const id = summary(1).id;
    const app = await renderApp({
      path: `/orders/${id}`,
      authenticated: true,
      routes: ordersApi([1]),
    });
    await screen.findByRole('heading', { name: 'Detalhe do pedido' });

    await app.user.click(await screen.findByRole('button', { name: 'Excluir pedido NP-1' }));
    await app.user.click(await screen.findByRole('button', { name: 'Excluir pedido' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Pedidos' })).toBeInTheDocument();
    expect(await screen.findByText('Nenhum pedido encontrado.')).toBeInTheDocument();
  });
});

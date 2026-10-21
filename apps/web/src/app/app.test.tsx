import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { problem, renderApp } from '@/test-utils/render-app';

describe('route protection (U30, U35)', () => {
  it('sends a visitor from a protected page back to the login', async () => {
    await renderApp({ path: '/orders' });

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pedidos' })).toBeNull();
  });

  it('redirects / according to the session', async () => {
    const visitor = await renderApp({ path: '/' });
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    visitor.unmount();

    await renderApp({ path: '/', authenticated: true });
    expect(screen.getByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
  });

  it('lets an authenticated user reach the shell and bounces them away from the login', async () => {
    const app = await renderApp({ path: '/orders', authenticated: true });

    expect(screen.getByRole('heading', { level: 1, name: 'Pedidos' })).toBeInTheDocument();
    await app.navigate('/login');
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Entrar' })).toBeNull();
  });

  it('logout returns to the login and hides the protected content', async () => {
    const app = await renderApp({ path: '/orders', authenticated: true });

    await app.user.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pedidos' })).toBeNull();
    expect(app.session().state).toEqual({ status: 'anonymous', expired: false });
  });

  it('an expired session (401) on a protected call sends the user to the login', async () => {
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: { '/api/v1/orders': () => problem(401, 'UNAUTHORIZED') },
    });

    await act(() =>
      app
        .session()
        .http.request('/api/v1/orders')
        .catch(() => undefined),
    );

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(app.session().state).toEqual({ status: 'anonymous', expired: true });
  });
});

describe('application layout (U35)', () => {
  it('has banner, labelled navigation, the user email, and a main landmark', async () => {
    await renderApp({ path: '/orders', authenticated: true });

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    expect(screen.getByText('demo@example.test')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
  });

  it('puts the skip link first in the keyboard order and points it at the content', async () => {
    const app = await renderApp({ path: '/orders', authenticated: true });

    await app.user.tab();

    const skip = screen.getByRole('link', { name: 'Ir para o conteúdo' });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#conteudo');
  });

  it('shows a not found page inside the layout and moves focus to the content on navigation', async () => {
    const app = await renderApp({ path: '/orders', authenticated: true });

    await app.navigate('/nao-existe');

    expect(
      await screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    await app.user.click(screen.getByRole('link', { name: 'Voltar ao início' }));
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
  });
});

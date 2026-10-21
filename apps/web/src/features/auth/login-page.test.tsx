import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  emptyList,
  json,
  loginSuccess,
  problem,
  type Route,
  renderApp,
} from '@/test-utils/render-app';

const email = () => screen.getByLabelText('E-mail');
const password = () => screen.getByLabelText('Senha');
const submit = () => screen.getByRole('button', { name: /Entrar|Entrando/ });

const loginCalls = (calls: { url: URL; init: RequestInit }[]) =>
  calls.filter((call) => call.url.pathname === '/api/v1/auth/login');

describe('LoginPage form (U30, U34, U35)', () => {
  it('renders labelled fields, a heading, and a submit button', async () => {
    await renderApp({ path: '/login' });

    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(email()).toHaveAttribute('type', 'email');
    expect(email()).toHaveAttribute('autocomplete', 'username');
    expect(password()).toHaveAttribute('type', 'password');
    expect(password()).toHaveAttribute('autocomplete', 'current-password');
    expect(submit()).toBeEnabled();
  });

  it('logs in with the typed credentials and opens the orders area', async () => {
    const app = await renderApp({ path: '/login' });

    await app.user.type(email(), 'Demo@Example.Test');
    await app.user.type(password(), 'segredo');
    await app.user.click(submit());

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
    const [call] = loginCalls(app.calls);
    expect(JSON.parse(String(call?.init.body))).toEqual({
      email: 'Demo@Example.Test',
      password: 'segredo',
    });
    expect(app.session().state.status).toBe('authenticated');
  });

  it('shows a calm credential error, keeps the email, and sends focus to the password field', async () => {
    const app = await renderApp({
      path: '/login',
      routes: { '/api/v1/auth/login': () => problem(401, 'INVALID_CREDENTIALS') },
    });
    await app.user.type(email(), 'demo@example.test');
    await app.user.type(password(), 'errada');

    await app.user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    expect(email()).toHaveValue('demo@example.test');
    expect(password()).toHaveFocus();
    expect(screen.queryByText(/sessão expirou/)).toBeNull();
    expect(app.session().state).toEqual({ status: 'anonymous', expired: false });
    expect(submit()).toBeEnabled();
  });

  it('validates empty and malformed input on the client without calling the API', async () => {
    const app = await renderApp({ path: '/login' });

    await app.user.click(submit());
    expect(email()).toHaveFocus();
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(email()).toHaveAccessibleDescription('Informe o e-mail.');
    expect(password()).toHaveAccessibleDescription('Informe a senha.');

    await app.user.type(email(), 'sem-arroba');
    await app.user.type(password(), 'x');
    await app.user.click(submit());
    expect(email()).toHaveAccessibleDescription('Informe um e-mail válido.');
    expect(loginCalls(app.calls)).toHaveLength(0);
  });

  it('maps a 400 from the API onto the fields without echoing API text', async () => {
    const app = await renderApp({
      path: '/login',
      routes: {
        '/api/v1/auth/login': () =>
          problem(400, 'VALIDATION_ERROR', {
            errors: [{ field: 'email', message: 'Invalid email address' }],
          }),
      },
    });
    await app.user.type(email(), 'a@b.co');
    await app.user.type(password(), 'x');

    await app.user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique os dados informados.');
    expect(email()).toHaveAccessibleDescription('Informe um e-mail válido.');
    expect(screen.queryByText('Invalid email address')).toBeNull();
    expect(email()).toHaveFocus();
  });

  it('reports a network failure safely and allows trying again', async () => {
    let online = false;
    const login: Route = () => {
      if (!online) throw new TypeError('Failed to fetch');
      return loginSuccess({ url: new URL('http://x'), init: {} });
    };
    const app = await renderApp({ path: '/login', routes: { '/api/v1/auth/login': login } });
    await app.user.type(email(), 'demo@example.test');
    await app.user.type(password(), 'segredo');

    await app.user.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível conectar ao servidor',
    );

    online = true;
    await app.user.click(submit());
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
  });

  it('blocks duplicate submissions while the request is pending and marks the form busy', async () => {
    let finish: (response: Response) => void = () => undefined;
    const app = await renderApp({
      path: '/login',
      routes: {
        '/api/v1/auth/login': () => new Promise<Response>((resolve) => (finish = resolve)),
      },
    });
    await app.user.type(email(), 'demo@example.test');
    await app.user.type(password(), 'segredo');

    await app.user.click(submit());
    await waitFor(() => expect(submit()).toBeDisabled());
    await app.user.click(submit());
    await app.user.type(password(), '{Enter}');

    expect(submit()).toHaveTextContent('Entrando…');
    expect(submit().closest('form')).toHaveAttribute('aria-busy', 'true');
    expect(loginCalls(app.calls)).toHaveLength(1);
    await act(async () => finish(json({ accessToken: 't', tokenType: 'Bearer', expiresIn: 3600 })));
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
  });

  it('differentiates an expired session from wrong credentials and clears the notice on success', async () => {
    let expire = true;
    const app = await renderApp({
      path: '/orders',
      authenticated: true,
      routes: {
        '/api/v1/orders': (request) => (expire ? problem(401, 'UNAUTHORIZED') : emptyList(request)),
      },
    });
    await screen.findByRole('heading', { name: 'Entrar' });
    expire = false;

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sua sessão expirou. Entre novamente.',
    );
    expect(screen.queryByRole('alert')).toBeNull();

    await app.user.type(email(), 'demo@example.test');
    await app.user.type(password(), 'segredo');
    await app.user.click(submit());
    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
  });

  it('supports the keyboard: tab order is email, password, button, and Enter submits', async () => {
    const app = await renderApp({ path: '/login' });

    await app.user.tab();
    expect(email()).toHaveFocus();
    await app.user.keyboard('demo@example.test');
    await app.user.tab();
    expect(password()).toHaveFocus();
    await app.user.keyboard('segredo');
    await app.user.tab();
    expect(submit()).toHaveFocus();
    await app.user.keyboard('{Enter}');

    expect(await screen.findByRole('heading', { name: 'Pedidos' })).toBeInTheDocument();
    expect(loginCalls(app.calls)).toHaveLength(1);
  });

  it('never exposes the password or token in the page, URL, or storage', async () => {
    const app = await renderApp({ path: '/login' });
    await app.user.type(email(), 'demo@example.test');
    await app.user.type(password(), 'segredo-que-nao-pode-vazar');
    await app.user.click(submit());
    await screen.findByRole('heading', { name: 'Pedidos' });

    expect(document.body.textContent).not.toContain('segredo-que-nao-pode-vazar');
    expect(document.body.textContent).not.toContain('jwt-test-token');
    expect(window.location.href).not.toContain('jwt-test-token');
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('logs out and, after a fresh mount, requires a new login', async () => {
    const first = await renderApp({ path: '/orders', authenticated: true });
    await first.user.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    first.unmount();

    await renderApp({ path: '/orders' });

    const form = screen.getByRole('heading', { name: 'Entrar' });
    expect(
      within(form.closest('main') as HTMLElement).getByLabelText('E-mail'),
    ).toBeInTheDocument();
  });
});

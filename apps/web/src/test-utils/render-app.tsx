import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router';
import { vi } from 'vitest';
import { AppRoutes } from '@/app/app-routes';
import { type Session, SessionProvider, useSession } from '@/features/auth/session-provider';

export type Route = (request: { url: URL; init: RequestInit }) => Response | Promise<Response>;

export const json = (body: unknown, status = 200) => Response.json(body, { status });

export const problem = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      type: 'about:blank',
      title: code,
      status,
      detail: `detail ${code}`,
      instance: '/x',
      code,
      requestId: '5f0d1b0e-3f0e-4a56-8b57-3d9d6f9c2a10',
      ...extra,
    }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );

export const emptyList: Route = () =>
  json({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });

export const loginSuccess: Route = () =>
  json({ accessToken: 'jwt-test-token', tokenType: 'Bearer', expiresIn: 3600 });

/** fetch double routed by path; pending requests reject with AbortError when their signal fires. */
export function createFakeApi(routes: Record<string, Route> = {}) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fetchImpl = vi.fn<typeof fetch>((input, init = {}) => {
    const url = new URL(String(input), 'http://web.test');
    calls.push({ url, init });
    const route = routes[url.pathname];
    return new Promise<Response>((resolve, reject) => {
      init.signal?.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError')),
      );
      Promise.resolve(route ? route({ url, init }) : new Response(null, { status: 404 })).then(
        resolve,
        reject,
      );
    });
  });
  return { fetchImpl, calls };
}

export interface RenderAppOptions {
  path?: string;
  routes?: Record<string, Route>;
  /** Log in (through the fake login route) before returning, then navigate to `path`. */
  authenticated?: boolean;
}

/** The real route table, session provider, and router in memory, talking to a fake API. */
export async function renderApp({
  path = '/',
  routes = {},
  authenticated = false,
}: RenderAppOptions = {}) {
  const api = createFakeApi({
    '/api/v1/auth/login': loginSuccess,
    '/api/v1/orders': emptyList,
    ...routes,
  });
  const captured: { session?: Session; navigate?: ReturnType<typeof useNavigate> } = {};

  function Probe() {
    captured.session = useSession();
    captured.navigate = useNavigate();
    return null;
  }

  const user = userEvent.setup();
  const utils = render(
    <SessionProvider fetchImpl={api.fetchImpl} baseUrl="">
      <MemoryRouter initialEntries={[authenticated ? '/login' : path]}>
        <Probe />
        <AppRoutes />
      </MemoryRouter>
    </SessionProvider>,
  );

  if (authenticated) {
    await act(() =>
      (captured.session as Session).login({ email: 'demo@example.test', password: 'secret' }),
    );
    await act(async () => (captured.navigate as ReturnType<typeof useNavigate>)(path));
  }
  return {
    ...utils,
    user,
    ...api,
    session: () => captured.session as Session,
    navigate: (to: string) =>
      act(async () => (captured.navigate as ReturnType<typeof useNavigate>)(to)),
  };
}

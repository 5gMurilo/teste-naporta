import { act, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, isAbortError } from '@/lib/http-client';
import { SessionProvider, useSession } from './session-provider';

const loginOk = () =>
  Response.json({ accessToken: 'jwt-123', tokenType: 'Bearer', expiresIn: 3600 });
const problem = (status: number, code: string) =>
  new Response(JSON.stringify({ code, status, detail: code, requestId: 'r' }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** A fetch whose pending requests reject with AbortError when their signal fires, like the browser. */
function createFetch(routes: Record<string, (init: RequestInit) => Response | Promise<Response>>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn<typeof fetch>((input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes[new URL(url, 'http://web.test').pathname];
    return new Promise<Response>((resolve, reject) => {
      init.signal?.addEventListener('abort', () =>
        reject(new DOMException('Aborted', 'AbortError')),
      );
      Promise.resolve(route ? route(init) : new Response(null, { status: 404 })).then(
        resolve,
        reject,
      );
    });
  });
  return { fetchImpl, calls };
}

function setup(routes: Parameters<typeof createFetch>[0]) {
  const { fetchImpl, calls } = createFetch(routes);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SessionProvider fetchImpl={fetchImpl} baseUrl="">
      {children}
    </SessionProvider>
  );
  return { ...renderHook(() => useSession(), { wrapper }), calls, fetchImpl };
}

type Call = { url: string; init: RequestInit };
const authorization = (call: Call | undefined): string | undefined =>
  (call?.init.headers as Record<string, string> | undefined)?.Authorization;

const credentials = { email: ' Demo@Example.Test ', password: 'secret' };

describe('SessionProvider (U30)', () => {
  it('starts anonymous and not expired', () => {
    const { result } = setup({});

    expect(result.current.state).toEqual({ status: 'anonymous', expired: false });
  });

  it('logs in, keeps the token in memory only, and sends it on later requests', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result, calls } = setup({
      '/api/v1/auth/login': loginOk,
      '/api/v1/orders': () => Response.json({ data: [] }),
    });

    await act(() => result.current.login(credentials));
    await act(() => result.current.http.request('/api/v1/orders'));

    expect(result.current.state).toEqual({ status: 'authenticated', email: 'demo@example.test' });
    const loginCall = calls[0];
    expect(authorization(loginCall)).toBeUndefined();
    expect(authorization(calls[1])).toBe('Bearer jwt-123');
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length + sessionStorage.length).toBe(0);
    expect(document.cookie).not.toContain('jwt-123');
    expect(window.location.href).not.toContain('jwt-123');
    expect(JSON.stringify(result.current.state)).not.toContain('jwt-123');
  });

  it('logout clears the token and aborts requests that are still pending', async () => {
    const slow = deferred<Response>();
    const { result, calls } = setup({
      '/api/v1/auth/login': loginOk,
      '/api/v1/orders': () => slow.promise,
    });
    await act(() => result.current.login(credentials));
    const pending = result.current.http.request('/api/v1/orders').catch((error) => error);

    act(() => result.current.logout());
    slow.resolve(Response.json({ data: ['private'] }));

    expect(isAbortError(await pending)).toBe(true);
    expect(result.current.state).toEqual({ status: 'anonymous', expired: false });
    await act(() => result.current.http.request('/api/v1/orders').catch(() => undefined));
    expect(authorization(calls.at(-1))).toBeUndefined();
  });

  it('a 401 on a protected request ends the session as expired and aborts the others', async () => {
    const slowResponse = deferred<Response>();
    const { result } = setup({
      '/api/v1/auth/login': loginOk,
      '/api/v1/orders': () => problem(401, 'UNAUTHORIZED'),
      '/api/v1/slow': () => slowResponse.promise,
    });
    await act(() => result.current.login(credentials));
    const slow = result.current.http.request('/api/v1/slow').catch((error) => error);

    await act(() => result.current.http.request('/api/v1/orders').catch(() => undefined));
    slowResponse.resolve(Response.json({ secret: true }));

    expect(result.current.state).toEqual({ status: 'anonymous', expired: true });
    expect(isAbortError(await slow)).toBe(true);
  });

  it('wrong credentials fail without marking the session expired or entering a loop', async () => {
    const { result, fetchImpl } = setup({
      '/api/v1/auth/login': () => problem(401, 'INVALID_CREDENTIALS'),
    });

    const failure = await act(() => result.current.login(credentials).catch((error) => error));

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe('INVALID_CREDENTIALS');
    expect(result.current.state).toEqual({ status: 'anonymous', expired: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('a successful login clears an earlier expiry flag', async () => {
    const { result } = setup({
      '/api/v1/auth/login': loginOk,
      '/api/v1/orders': () => problem(401, 'UNAUTHORIZED'),
    });
    await act(() => result.current.login(credentials));
    await act(() => result.current.http.request('/api/v1/orders').catch(() => undefined));
    expect(result.current.state).toEqual({ status: 'anonymous', expired: true });

    await act(() => result.current.login(credentials));

    expect(result.current.state.status).toBe('authenticated');
  });

  it('drops a login that finishes after the session was ended in the meantime', async () => {
    const slowLogin = deferred<Response>();
    const { result } = setup({ '/api/v1/auth/login': () => slowLogin.promise });

    let login: Promise<void> = Promise.resolve();
    act(() => {
      login = result.current.login(credentials);
    });
    act(() => result.current.logout());
    slowLogin.resolve(loginOk());
    await act(() => login.catch(() => undefined));

    expect(result.current.state.status).toBe('anonymous');
  });

  it('a new mount (page reload) always starts without a session', async () => {
    const first = setup({ '/api/v1/auth/login': loginOk });
    await act(() => first.result.current.login(credentials));
    first.unmount();

    const reloaded = setup({});

    expect(reloaded.result.current.state).toEqual({ status: 'anonymous', expired: false });
  });

  it('refuses to be used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    function Probe() {
      useSession();
      return null;
    }

    expect(() => render(<Probe />)).toThrow('useSession must be used inside a SessionProvider');
    consoleError.mockRestore();
  });
});

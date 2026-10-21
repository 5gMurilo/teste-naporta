import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  createHttpClient,
  isAbortError,
  NETWORK_ERROR_MESSAGE,
  NetworkError,
} from './http-client';

const problem = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      type: 'about:blank',
      title: 'Title',
      status,
      detail: `detail ${code}`,
      instance: '/api/v1/x',
      code,
      requestId: '5f0d1b0e-3f0e-4a56-8b57-3d9d6f9c2a10',
      ...extra,
    }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );

function setup(respond: () => Response | Promise<Response>, token: string | null = 'tok') {
  const fetchImpl = vi.fn<typeof fetch>(async () => respond());
  const onUnauthorized = vi.fn();
  const client = createHttpClient({
    getToken: () => token ?? undefined,
    onUnauthorized,
    baseUrl: 'http://api.test',
    fetchImpl,
  });
  return { client, fetchImpl, onUnauthorized };
}

const lastCall = (fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>) => {
  const [url, init] = fetchImpl.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
};

describe('createHttpClient success paths (U30)', () => {
  it('sends the bearer token and parses a JSON body', async () => {
    const { client, fetchImpl } = setup(() => Response.json({ ok: true }));

    await expect(client.request<{ ok: boolean }>('/api/v1/orders')).resolves.toEqual({ ok: true });

    const { url, init, headers } = lastCall(fetchImpl);
    expect(url).toBe('http://api.test/api/v1/orders');
    expect(init.method).toBe('GET');
    expect(headers.Authorization).toBe('Bearer tok');
  });

  it('serializes a JSON body with its content type and the chosen method', async () => {
    const { client, fetchImpl } = setup(() => Response.json({ id: 1 }, { status: 201 }));

    await client.request('/api/v1/orders', { method: 'POST', body: { orderNumber: 'NP-1' } });

    const { init, headers } = lastCall(fetchImpl);
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"orderNumber":"NP-1"}');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('does not try to parse the body of a 204', async () => {
    const response = new Response(null, { status: 204 });
    const json = vi.spyOn(response, 'json');
    const { client } = setup(() => response);

    await expect(client.request('/api/v1/orders/1', { method: 'DELETE' })).resolves.toBeUndefined();

    expect(json).not.toHaveBeenCalled();
  });

  it('builds the query string, omitting empty values, and never places the token in the URL', async () => {
    const { client, fetchImpl } = setup(() => Response.json({}), 'secret-token');

    await client.request('/api/v1/orders', {
      query: { orderNumber: 'NP 1', status: '', page: 2, createdFrom: undefined },
    });

    const { url } = lastCall(fetchImpl);
    expect(url).toBe('http://api.test/api/v1/orders?orderNumber=NP+1&page=2');
    expect(url).not.toContain('secret-token');
  });

  it('omits the Authorization header for public requests and when there is no session', async () => {
    const publicClient = setup(() => Response.json({}));
    const anonymous = setup(() => Response.json({}), null);

    await publicClient.client.request('/api/v1/auth/login', {
      method: 'POST',
      authenticated: false,
    });
    await anonymous.client.request('/api/v1/orders');

    expect(lastCall(publicClient.fetchImpl).headers.Authorization).toBeUndefined();
    expect(lastCall(anonymous.fetchImpl).headers.Authorization).toBeUndefined();
  });

  it('reads the token on every request so a new session is used immediately', async () => {
    let token: string | undefined = 'first';
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json({}));
    const client = createHttpClient({
      getToken: () => token,
      onUnauthorized: () => undefined,
      baseUrl: '',
      fetchImpl,
    });

    await client.request('/a');
    token = 'second';
    await client.request('/b');

    expect(lastCall(fetchImpl).headers.Authorization).toBe('Bearer second');
    const [, firstInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect((firstInit.headers as Record<string, string>).Authorization).toBe('Bearer first');
  });
});

describe('createHttpClient failures (U30, U33)', () => {
  it('keeps field errors of a 400 validation problem', async () => {
    const errors = [{ field: 'items', message: 'Too small' }];
    const { client } = setup(() => problem(400, 'VALIDATION_ERROR', { errors }));

    const failure = await client
      .request('/api/v1/orders', { method: 'POST', body: {} })
      .catch((e) => e);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', errors });
    expect(failure.requestId).toBe('5f0d1b0e-3f0e-4a56-8b57-3d9d6f9c2a10');
  });

  it('exposes the code of a 409 conflict', async () => {
    const { client } = setup(() => problem(409, 'ORDER_NUMBER_ALREADY_EXISTS'));

    const failure = await client
      .request('/api/v1/orders', { method: 'POST', body: {} })
      .catch((e) => e);

    expect(failure).toMatchObject({ status: 409, code: 'ORDER_NUMBER_ALREADY_EXISTS', errors: [] });
  });

  it('notifies the session exactly once when a request with a token gets 401', async () => {
    const { client, onUnauthorized } = setup(() => problem(401, 'UNAUTHORIZED'));

    await expect(client.request('/api/v1/orders')).rejects.toMatchObject({ status: 401 });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not treat wrong credentials on a public request, or a 401 without a session, as an expired session', async () => {
    const login = setup(() => problem(401, 'INVALID_CREDENTIALS'));
    const anonymous = setup(() => problem(401, 'UNAUTHORIZED'), null);

    await expect(
      login.client.request('/api/v1/auth/login', { method: 'POST', authenticated: false }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(anonymous.client.request('/api/v1/orders')).rejects.toMatchObject({ status: 401 });

    expect(login.onUnauthorized).not.toHaveBeenCalled();
    expect(anonymous.onUnauthorized).not.toHaveBeenCalled();
  });

  it('replaces a non Problem Details error body (proxy HTML) with a generic message', async () => {
    const { client } = setup(
      () => new Response('<html>502 Bad Gateway at 10.0.0.1</html>', { status: 502 }),
    );

    const failure = await client.request('/api/v1/orders').catch((e) => e);

    expect(failure).toMatchObject({ status: 502, code: 'HTTP_ERROR' });
    expect(failure.message).not.toContain('10.0.0.1');
  });

  it('turns a rejected fetch into a NetworkError with a safe message', async () => {
    const { client, onUnauthorized } = setup(() =>
      Promise.reject(new TypeError('Failed to fetch')),
    );

    const failure = await client.request('/api/v1/orders').catch((e) => e);

    expect(failure).toBeInstanceOf(NetworkError);
    expect(failure.message).toBe(NETWORK_ERROR_MESSAGE);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('rethrows an aborted request as an abort, not as a network failure', async () => {
    const controller = new AbortController();
    const { client } = setup(() => Promise.reject(new DOMException('Aborted', 'AbortError')));
    controller.abort();

    const failure = await client
      .request('/api/v1/orders', { signal: controller.signal })
      .catch((e) => e);

    expect(isAbortError(failure)).toBe(true);
    expect(failure).not.toBeInstanceOf(NetworkError);
  });

  it('reports an unreadable success body as INVALID_RESPONSE', async () => {
    const { client } = setup(() => new Response('not json', { status: 200 }));

    await expect(client.request('/api/v1/orders')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it.each(['POST', 'PATCH', 'DELETE', 'GET'] as const)(
    'never retries a failed %s request',
    async (method) => {
      const { client, fetchImpl } = setup(() => Promise.reject(new TypeError('Failed to fetch')));

      await client
        .request('/api/v1/orders/1', { method, body: method === 'GET' ? undefined : {} })
        .catch(() => undefined);

      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );
});

describe('payloads against the exported OpenAPI contract', () => {
  const doc = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../../../docs/openapi.json'), 'utf8'),
  );
  const schemas = doc.components.schemas as Record<
    string,
    { properties: Record<string, unknown>; required?: string[] }
  >;

  it('reads the Problem Details fields that the contract defines', () => {
    for (const field of ['status', 'detail', 'code', 'requestId']) {
      expect(Object.keys(schemas.ProblemDetails?.properties ?? {})).toContain(field);
    }
    expect(Object.keys(schemas.ValidationProblemDetails?.properties ?? {})).toContain('errors');
    expect(Object.keys(schemas.FieldError?.properties ?? {}).sort()).toEqual(['field', 'message']);
  });

  it('sends the login fields and understands the login response of the contract', () => {
    expect(Object.keys(schemas.LoginRequest?.properties ?? {}).sort()).toEqual([
      'email',
      'password',
    ]);
    expect(Object.keys(schemas.LoginResponse?.properties ?? {}).sort()).toEqual([
      'accessToken',
      'expiresIn',
      'tokenType',
    ]);
  });
});

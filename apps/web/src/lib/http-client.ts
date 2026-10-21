import type { FieldError, ProblemDetails } from './api-types';
import { apiBaseUrl } from './env';

export const NETWORK_ERROR_MESSAGE =
  'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
const GENERIC_ERROR_MESSAGE = 'Não foi possível concluir a operação. Tente novamente.';

/** The API answered with an error status. `detail` and `errors` come from the API and are safe to show. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors: FieldError[];
  readonly requestId: string | undefined;

  constructor(init: {
    status: number;
    code: string;
    detail: string;
    errors?: FieldError[];
    requestId?: string;
  }) {
    super(init.detail);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.errors = init.errors ?? [];
    this.requestId = init.requestId;
  }
}

/** No HTTP response at all (offline, DNS, refused connection). */
export class NetworkError extends Error {
  constructor() {
    super(NETWORK_ERROR_MESSAGE);
    this.name = 'NetworkError';
  }
}

/** A cancelled request is not a failure; callers should usually ignore it. */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export type QueryValue = string | number | undefined;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  /** false for public operations (login): no Bearer header and a 401 does not end the session. */
  authenticated?: boolean;
}

export interface HttpClientOptions {
  /** Read on every request, so a new session is picked up without recreating the client. */
  getToken: () => string | undefined;
  /** Called when a request that carried a token was rejected with 401. */
  onUnauthorized: () => void;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface HttpClient {
  request<T = void>(path: string, options?: RequestOptions): Promise<T>;
}

function buildUrl(baseUrl: string, path: string, query: RequestOptions['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${baseUrl}${path}${search ? `?${search}` : ''}`;
}

function isProblem(value: unknown): value is Partial<ProblemDetails> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ProblemDetails).code === 'string'
  );
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  if (isProblem(body)) {
    return new ApiError({
      status: response.status,
      code: body.code as string,
      detail: typeof body.detail === 'string' ? body.detail : GENERIC_ERROR_MESSAGE,
      errors: Array.isArray(body.errors) ? body.errors : [],
      requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
    });
  }
  // Not a Problem Details body (for example an HTML error page from a proxy): never show it.
  return new ApiError({
    status: response.status,
    code: 'HTTP_ERROR',
    detail: GENERIC_ERROR_MESSAGE,
  });
}

/**
 * The only place that talks HTTP. It never retries (a repeated POST could duplicate an order), never
 * puts credentials in a URL, and turns every outcome into a value or one of ApiError, NetworkError, or
 * the browser's AbortError.
 */
export function createHttpClient(options: HttpClientOptions): HttpClient {
  const fetchImpl = options.fetchImpl ?? ((...args) => globalThis.fetch(...args));
  const baseUrl = (options.baseUrl ?? apiBaseUrl).replace(/\/+$/, '');

  return {
    async request<T = void>(path: string, request: RequestOptions = {}): Promise<T> {
      const authenticated = request.authenticated ?? true;
      const token = authenticated ? options.getToken() : undefined;
      const headers: Record<string, string> = {
        Accept: 'application/json, application/problem+json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (request.body !== undefined) headers['Content-Type'] = 'application/json';

      let response: Response;
      try {
        response = await fetchImpl(buildUrl(baseUrl, path, request.query), {
          method: request.method ?? 'GET',
          headers,
          body: request.body === undefined ? undefined : JSON.stringify(request.body),
          signal: request.signal,
        });
      } catch (error) {
        if (isAbortError(error)) throw error;
        throw new NetworkError();
      }

      if (!response.ok) {
        const failure = await toApiError(response);
        if (response.status === 401 && authenticated && token) options.onUnauthorized();
        throw failure;
      }
      if (response.status === 204) return undefined as T;
      try {
        return (await response.json()) as T;
      } catch (error) {
        if (isAbortError(error)) throw error;
        throw new ApiError({
          status: response.status,
          code: 'INVALID_RESPONSE',
          detail: GENERIC_ERROR_MESSAGE,
        });
      }
    },
  };
}

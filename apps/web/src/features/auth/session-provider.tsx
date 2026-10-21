import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { LoginRequest, LoginResponse } from '@/lib/api-types';
import { createHttpClient, type HttpClient, type RequestOptions } from '@/lib/http-client';

type SessionState =
  | { status: 'anonymous'; expired: boolean }
  | { status: 'authenticated'; email: string };

export interface Session {
  state: SessionState;
  /** Rejects with ApiError/NetworkError on failure; wrong credentials never mark the session expired. */
  login(credentials: LoginRequest): Promise<void>;
  logout(): void;
  /** HTTP client bound to this session: it carries the token and is aborted when the session ends. */
  http: HttpClient;
}

const SessionContext = createContext<Session | undefined>(undefined);

export interface SessionProviderProps {
  children: ReactNode;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

/**
 * Holds the bearer token in a ref only: never in storage, cookies, or the URL, so a reload always
 * starts logged out. Ending the session (logout or a 401) aborts every request still in flight, so
 * a late response can no longer repopulate the UI with private data.
 */
export function SessionProvider({ children, fetchImpl, baseUrl }: SessionProviderProps) {
  const [state, setState] = useState<SessionState>({ status: 'anonymous', expired: false });
  const token = useRef<string | undefined>(undefined);
  const epoch = useRef(0);
  const controller = useRef(new AbortController());

  const endSession = useCallback((expired: boolean) => {
    token.current = undefined;
    epoch.current += 1;
    controller.current.abort();
    controller.current = new AbortController();
    setState({ status: 'anonymous', expired });
  }, []);

  const http = useMemo<HttpClient>(() => {
    const client = createHttpClient({
      getToken: () => token.current,
      onUnauthorized: () => endSession(true),
      fetchImpl,
      baseUrl,
    });
    return {
      request: <T = void>(path: string, options: RequestOptions = {}) => {
        const sessionSignal = controller.current.signal;
        const signal = options.signal
          ? AbortSignal.any([sessionSignal, options.signal])
          : sessionSignal;
        return client.request<T>(path, { ...options, signal });
      },
    };
  }, [endSession, fetchImpl, baseUrl]);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const startedAt = epoch.current;
      const response = await http.request<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: credentials,
        authenticated: false,
      });
      // The session changed while the login was in flight (logout, expiry): drop the result.
      if (epoch.current !== startedAt) return;
      token.current = response.accessToken;
      setState({ status: 'authenticated', email: credentials.email.trim().toLowerCase() });
    },
    [http],
  );

  const logout = useCallback(() => endSession(false), [endSession]);

  const value = useMemo<Session>(
    () => ({ state, login, logout, http }),
    [state, login, logout, http],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside a SessionProvider');
  return session;
}

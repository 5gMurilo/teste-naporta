import { Navigate, useLocation } from 'react-router';
import { LoginPage } from './login-page';
import { useSession } from './session-provider';

/** Only in-app absolute paths are honoured, so a crafted state can never redirect off-site. */
export function safeRedirect(target: unknown): string {
  return typeof target === 'string' && /^\/(?![/\\])/.test(target) && !target.startsWith('/login')
    ? target
    : '/orders';
}

export function LoginRoute() {
  const { state } = useSession();
  const location = useLocation();
  if (state.status === 'authenticated') {
    return (
      <Navigate to={safeRedirect((location.state as { from?: unknown } | null)?.from)} replace />
    );
  }
  return <LoginPage />;
}

import { Navigate, Outlet, useLocation } from 'react-router';
import { useSession } from '@/features/auth/session-provider';

/** Renders the nested routes only for an authenticated session; visitors are sent to the login. */
export function ProtectedRoute() {
  const { state } = useSession();
  const location = useLocation();
  if (state.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

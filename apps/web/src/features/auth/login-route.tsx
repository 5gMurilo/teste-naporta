import { Navigate } from 'react-router';
import { useSession } from './session-provider';

/** Temporary login route: sends authenticated users on; the real form replaces the body later. */
export function LoginRoute() {
  const { state } = useSession();
  if (state.status === 'authenticated') return <Navigate to="/orders" replace />;
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-semibold">Entrar</h1>
    </main>
  );
}

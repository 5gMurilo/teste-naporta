import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth/session-provider';

/** Shell for authenticated pages: skip link, banner with logout, and a focusable main region. */
export function AppLayout() {
  const { state, logout } = useSession();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);

  // After a navigation, move focus to the content so keyboard and screen reader users start there.
  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      main.current?.focus();
    }
  }, [pathname]);

  return (
    <div className="min-h-screen">
      <a
        href="#conteudo"
        className="bg-background focus:ring-ring sr-only rounded-md px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:ring-2"
      >
        Ir para o conteúdo
      </a>
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link to="/orders" className="text-lg font-semibold">
            naPorta
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-3">
            {state.status === 'authenticated' && (
              <span className="text-muted-foreground text-sm">{state.email}</span>
            )}
            <Button type="button" variant="outline" size="sm" onClick={logout}>
              Sair
            </Button>
          </nav>
        </div>
      </header>
      <main
        id="conteudo"
        ref={main}
        tabIndex={-1}
        className="mx-auto max-w-5xl px-4 py-6 outline-none"
      >
        <Outlet />
      </main>
    </div>
  );
}

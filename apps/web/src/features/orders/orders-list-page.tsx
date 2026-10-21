import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AsyncState } from '@/components/async-state';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth/session-provider';
import type { ListOrdersResponse } from '@/lib/api-types';
import { isAbortError } from '@/lib/http-client';
import { EMPTY_FILTERS, type OrderFilters, OrdersFilters } from './orders-filters';
import { OrdersTable } from './orders-table';

const PAGE_SIZE = 20;

export function OrdersListPage() {
  const { http } = useSession();
  const [filters, setFilters] = useState<OrderFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<ListOrdersResponse>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);

  // `reload` is only a trigger: bumping it re-runs the request after a failure.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    http
      .request<ListOrdersResponse>('/api/v1/orders', {
        query: { ...filters, page, pageSize: PAGE_SIZE },
        signal: controller.signal,
      })
      .then((response) => {
        if (controller.signal.aborted) return;
        setResult(response);
        setLoading(false);
      })
      .catch((failure) => {
        // A superseded request (new filters, page, or logout) must not touch the screen.
        if (controller.signal.aborted || isAbortError(failure)) return;
        setResult(undefined);
        setError(failure);
        setLoading(false);
      });
    return () => controller.abort();
  }, [http, filters, page, reload]);

  // The page may no longer exist (the last item of the last page was deleted, or other changes
  // shrank the list): go to the last page that does.
  useEffect(() => {
    if (result && result.data.length === 0 && page > 1) {
      setPage(Math.max(Math.min(result.meta.totalPages, page - 1), 1));
    }
  }, [result, page]);

  const heading = useRef<HTMLHeadingElement>(null);
  const afterDelete = () => {
    setReload((count) => count + 1);
    // The deleted row held the focus; hand it to the page title so keyboard users keep their place.
    heading.current?.focus();
  };

  const meta = result?.meta;
  const totalPages = Math.max(meta?.totalPages ?? 1, 1);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
          Pedidos
        </h1>
        <Button asChild>
          <Link to="/orders/new">Novo pedido</Link>
        </Button>
      </div>
      <OrdersFilters
        applied={filters}
        onApply={(next) => {
          // A fresh object so applying unchanged filters still refreshes the results.
          setFilters({ ...next });
          setPage(1);
        }}
        onClear={() => {
          setFilters(EMPTY_FILTERS);
          setPage(1);
        }}
      />
      <AsyncState
        loading={loading}
        error={error}
        empty={result?.data.length === 0}
        emptyMessage="Nenhum pedido encontrado."
        onRetry={() => setReload((count) => count + 1)}
      >
        {result && (
          <div className="grid gap-4">
            <OrdersTable orders={result.data} onDeleted={afterDelete} />
            <nav
              aria-label="Paginação"
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <p className="text-muted-foreground text-sm" aria-live="polite">
                Página {meta?.page} de {totalPages} · {meta?.total} pedido(s)
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Próxima
                </Button>
              </div>
            </nav>
          </div>
        )}
      </AsyncState>
    </div>
  );
}

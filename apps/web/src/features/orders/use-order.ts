import { useCallback, useEffect, useState } from 'react';
import { useSession } from '@/features/auth/session-provider';
import type { OrderDetail } from '@/lib/api-types';
import { isAbortError } from '@/lib/http-client';

/**
 * Loads one order. A response for a previous id (or one that arrives after logout) is discarded,
 * and `reload` repeats the request after a failure.
 */
export function useOrder(id: string) {
  const { http } = useSession();
  const [order, setOrder] = useState<OrderDetail>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    setOrder(undefined);
    http
      .request<OrderDetail>(`/api/v1/orders/${encodeURIComponent(id)}`, {
        signal: controller.signal,
      })
      .then((response) => {
        if (controller.signal.aborted) return;
        setOrder(response);
        setLoading(false);
      })
      .catch((failure) => {
        if (controller.signal.aborted || isAbortError(failure)) return;
        setError(failure);
        setLoading(false);
      });
    return () => controller.abort();
  }, [http, id, attempt]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  return { order, error, loading, reload };
}

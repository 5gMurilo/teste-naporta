import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/error-message';

export interface AsyncStateProps {
  loading: boolean;
  error?: unknown;
  /** True when the request succeeded and returned nothing to show. */
  empty?: boolean;
  emptyMessage?: string;
  /** Present on error; the retry button is only rendered when it is provided. */
  onRetry?: () => void;
  children: ReactNode;
}

/**
 * Exactly one of loading, error, empty, or content is rendered. Errors never leak payloads, and a
 * failure is never announced as a success.
 */
export function AsyncState({
  loading,
  error,
  empty = false,
  emptyMessage = 'Nenhum resultado encontrado.',
  onRetry,
  children,
}: AsyncStateProps) {
  if (loading) {
    return (
      <p role="status" className="text-muted-foreground py-8 text-center">
        Carregando…
      </p>
    );
  }
  if (error !== undefined && error !== null) {
    return (
      <div role="alert" className="border-destructive/50 rounded-md border p-4">
        <p className="text-destructive font-medium">{errorMessage(error)}</p>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }
  if (empty) {
    return (
      <p role="status" className="text-muted-foreground py-8 text-center">
        {emptyMessage}
      </p>
    );
  }
  return <>{children}</>;
}

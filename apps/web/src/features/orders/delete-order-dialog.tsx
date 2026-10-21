import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth/session-provider';
import { errorMessage } from '@/lib/error-message';
import { isAbortError } from '@/lib/http-client';

interface DeleteOrderDialogProps {
  order: { id: string; orderNumber: string };
  /** Called after the API confirmed the deletion with 204. */
  onDeleted: () => void;
  triggerVariant?: 'outline' | 'destructive';
}

/**
 * Asks for confirmation, then sends one DELETE and waits for its 204 before reporting success. The
 * dialog cannot be dismissed while the request is in flight, and a failure keeps it open with the reason.
 */
export function DeleteOrderDialog({
  order,
  onDeleted,
  triggerVariant = 'outline',
}: DeleteOrderDialogProps) {
  const { http } = useSession();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) setError(undefined);
  }

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      await http.request(`/api/v1/orders/${encodeURIComponent(order.id)}`, { method: 'DELETE' });
      setOpen(false);
      onDeleted();
    } catch (failure) {
      if (!isAbortError(failure)) setError(errorMessage(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size="sm"
          aria-label={`Excluir pedido ${order.orderNumber}`}
        >
          Excluir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir o pedido {order.orderNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            O pedido deixa de aparecer nas listas e consultas. O número {order.orderNumber} continua
            reservado e não poderá ser usado em outro pedido.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm font-medium">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending} onClick={confirm}>
            {pending ? 'Excluindo…' : 'Excluir pedido'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

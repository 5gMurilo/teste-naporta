import { Link, useNavigate, useParams } from 'react-router';
import { AsyncState } from '@/components/async-state';
import { useSession } from '@/features/auth/session-provider';
import type { OrderDetail, UpdateOrderPayload } from '@/lib/api-types';
import { errorMessage } from '@/lib/error-message';
import { ApiError } from '@/lib/http-client';
import { OrderForm } from './order-form';
import { useOrder } from './use-order';

/**
 * Loads the order, lets the user change it, and sends only the changes in one PATCH. Nothing is
 * shown as saved until the API answers 200; afterwards the detail page reads the confirmed order.
 */
export function EditOrderPage() {
  const { id = '' } = useParams();
  const { http } = useSession();
  const navigate = useNavigate();
  const { order, error, loading, reload } = useOrder(id);
  const notFound = error instanceof ApiError && error.status === 404;

  async function save(changes: UpdateOrderPayload) {
    await http.request<OrderDetail>(`/api/v1/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: changes,
    });
    navigate(`/orders/${id}`);
  }

  return (
    <div className="grid gap-6">
      <div>
        <Link to={`/orders/${id}`} className="text-sm underline underline-offset-4">
          Voltar ao pedido
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Editar pedido</h1>
      </div>
      {notFound ? (
        <p role="alert" className="text-destructive font-medium">
          {errorMessage(error)}
        </p>
      ) : (
        <AsyncState loading={loading} error={error} onRetry={reload}>
          {order && (
            <OrderForm
              mode="edit"
              initialOrder={order}
              onSubmit={save}
              onCancel={() => navigate(`/orders/${id}`)}
            />
          )}
        </AsyncState>
      )}
    </div>
  );
}

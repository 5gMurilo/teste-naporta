import { useNavigate } from 'react-router';
import { useSession } from '@/features/auth/session-provider';
import type { CreateOrderPayload, OrderDetail } from '@/lib/api-types';
import { OrderForm } from './order-form';

/**
 * Sends the form's payload as a single POST. A failure is handed back to the form, which keeps what
 * the user typed; the request is never repeated automatically because that could create the order twice.
 */
export function CreateOrderPage() {
  const { http } = useSession();
  const navigate = useNavigate();

  async function create(payload: CreateOrderPayload) {
    const created = await http.request<OrderDetail>('/api/v1/orders', {
      method: 'POST',
      body: payload,
    });
    navigate(`/orders/${created.id}`);
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Novo pedido</h1>
      <OrderForm mode="create" onSubmit={create} onCancel={() => navigate('/orders')} />
    </div>
  );
}

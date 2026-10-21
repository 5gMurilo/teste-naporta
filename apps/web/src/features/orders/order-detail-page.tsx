import { Link, useNavigate, useParams } from 'react-router';
import { AsyncState } from '@/components/async-state';
import { Button } from '@/components/ui/button';
import type { OrderDetail } from '@/lib/api-types';
import { errorMessage } from '@/lib/error-message';
import { formatBRL, formatCivilDate, formatInstant, STATUS_LABELS } from '@/lib/format';
import { ApiError } from '@/lib/http-client';
import { DeleteOrderDialog } from './delete-order-dialog';
import { useOrder } from './use-order';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { order, error, loading, reload } = useOrder(id);
  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <div className="grid gap-6">
      <div>
        <Link to="/orders" className="text-sm underline underline-offset-4">
          Voltar para a lista
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">Detalhe do pedido</h1>
          {order && (
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to={`/orders/${order.id}/edit`}>Editar</Link>
              </Button>
              <DeleteOrderDialog order={order} onDeleted={() => navigate('/orders')} />
            </div>
          )}
        </div>
      </div>
      {notFound ? (
        <p role="alert" className="text-destructive font-medium">
          {errorMessage(error)}
        </p>
      ) : (
        <AsyncState loading={loading} error={error} onRetry={reload}>
          {order && <OrderDetails order={order} />}
        </AsyncState>
      )}
    </div>
  );
}

function OrderDetails({ order }: { order: OrderDetail }) {
  const { deliveryAddress: address } = order;
  return (
    <div className="grid gap-6">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Número do pedido">{order.orderNumber}</Field>
        <Field label="Status">{STATUS_LABELS[order.status]}</Field>
        <Field label="Previsão de entrega">{formatCivilDate(order.expectedDeliveryDate)}</Field>
        <Field label="Cliente">{order.customer.name}</Field>
        <Field label="Documento">{order.customer.document}</Field>
        <Field label="Criado em">{formatInstant(order.createdAt)}</Field>
        <Field label="Atualizado em">{formatInstant(order.updatedAt)}</Field>
      </dl>
      <section aria-labelledby="address-heading">
        <h2 id="address-heading" className="mb-2 text-lg font-medium">
          Endereço de entrega
        </h2>
        <address className="not-italic">
          {address.street}, {address.number}
          {address.complement ? ` - ${address.complement}` : ''}
          <br />
          {address.neighborhood} · {address.city}/{address.state} · CEP {address.postalCode}
        </address>
      </section>
      <section aria-labelledby="items-heading">
        <h2 id="items-heading" className="mb-2 text-lg font-medium">
          Itens
        </h2>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Itens do pedido</caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="px-3 py-2 font-medium">
                Descrição
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Preço
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="px-3 py-2">{item.description}</td>
                <td className="px-3 py-2 text-right">{formatBRL(item.priceCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="px-3 py-2 font-semibold">
                Total
              </th>
              <td className="px-3 py-2 text-right font-semibold">{formatBRL(order.totalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  );
}

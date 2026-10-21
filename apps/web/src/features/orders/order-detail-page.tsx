import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AsyncState } from '@/components/async-state';
import { useSession } from '@/features/auth/session-provider';
import type { OrderDetail } from '@/lib/api-types';
import { errorMessage } from '@/lib/error-message';
import { formatBRL, formatCivilDate, formatInstant, STATUS_LABELS } from '@/lib/format';
import { ApiError, isAbortError } from '@/lib/http-client';

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
  const { http } = useSession();
  const [order, setOrder] = useState<OrderDetail>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
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
  }, [http, id, reload]);

  const notFound = error instanceof ApiError && error.status === 404;

  return (
    <div className="grid gap-6">
      <div>
        <Link to="/orders" className="text-sm underline underline-offset-4">
          Voltar para a lista
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Detalhe do pedido</h1>
      </div>
      {notFound ? (
        <p role="alert" className="text-destructive font-medium">
          {errorMessage(error)}
        </p>
      ) : (
        <AsyncState loading={loading} error={error} onRetry={() => setReload((count) => count + 1)}>
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

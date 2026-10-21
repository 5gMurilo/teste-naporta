import type { OrderSummary } from '@/lib/api-types';
import { formatCivilDate, formatInstant, STATUS_LABELS } from '@/lib/format';

export function OrdersTable({ orders }: { orders: OrderSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Pedidos encontrados</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="px-3 py-2 font-medium">
              Número
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Status
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Cliente
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Previsão de entrega
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Criado em
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b">
              <th scope="row" className="px-3 py-2 font-medium">
                {order.orderNumber}
              </th>
              <td className="px-3 py-2">{STATUS_LABELS[order.status]}</td>
              <td className="px-3 py-2">{order.customer.name}</td>
              <td className="px-3 py-2">{formatCivilDate(order.expectedDeliveryDate)}</td>
              <td className="px-3 py-2">{formatInstant(order.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

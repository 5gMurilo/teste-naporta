import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/api-types';
import { STATUS_LABELS } from '@/lib/format';

export interface OrderFilters {
  orderNumber: string;
  status: OrderStatus | '';
  createdFrom: string;
  createdTo: string;
}

export const EMPTY_FILTERS: OrderFilters = {
  orderNumber: '',
  status: '',
  createdFrom: '',
  createdTo: '',
};

export const RANGE_ERROR = 'A data inicial não pode ser posterior à data final.';

export function OrdersFilters({
  applied,
  onApply,
  onClear,
}: {
  applied: OrderFilters;
  onApply: (filters: OrderFilters) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<OrderFilters>(applied);
  const [rangeError, setRangeError] = useState<string>();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.createdFrom && draft.createdTo && draft.createdFrom > draft.createdTo) {
      setRangeError(RANGE_ERROR);
      return;
    }
    setRangeError(undefined);
    onApply(draft);
  }

  function clear() {
    setDraft(EMPTY_FILTERS);
    setRangeError(undefined);
    onClear();
  }

  const field = <K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Filtros de pedidos"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="grid gap-2">
        <Label htmlFor="filter-order-number">Número do pedido</Label>
        <Input
          id="filter-order-number"
          value={draft.orderNumber}
          onChange={(event) => field('orderNumber', event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="filter-status">Status</Label>
        <select
          id="filter-status"
          value={draft.status}
          onChange={(event) => field('status', event.target.value as OrderStatus | '')}
          className="border-input bg-background focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
        >
          <option value="">Todos</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="filter-created-from">Criado a partir de</Label>
        <Input
          id="filter-created-from"
          type="date"
          value={draft.createdFrom}
          onChange={(event) => field('createdFrom', event.target.value)}
          aria-invalid={rangeError ? true : undefined}
          aria-describedby={rangeError ? 'filter-range-error' : undefined}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="filter-created-to">Criado até</Label>
        <Input
          id="filter-created-to"
          type="date"
          value={draft.createdTo}
          onChange={(event) => field('createdTo', event.target.value)}
          aria-invalid={rangeError ? true : undefined}
          aria-describedby={rangeError ? 'filter-range-error' : undefined}
        />
      </div>
      {rangeError && (
        <p
          id="filter-range-error"
          role="alert"
          className="text-destructive text-sm sm:col-span-2 lg:col-span-4"
        >
          {rangeError}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
        <Button type="submit">Aplicar filtros</Button>
        <Button type="button" variant="outline" onClick={clear}>
          Limpar filtros
        </Button>
      </div>
    </form>
  );
}

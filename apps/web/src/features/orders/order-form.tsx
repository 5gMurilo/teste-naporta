import { type FormEvent, useEffect, useRef, useState } from 'react';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  type CreateOrderPayload,
  ORDER_STATUSES,
  type OrderDetail,
  type OrderStatus,
  type UpdateOrderPayload,
} from '@/lib/api-types';
import { errorMessage } from '@/lib/error-message';
import { STATUS_LABELS } from '@/lib/format';
import { ApiError } from '@/lib/http-client';
import { AddressFields } from './address-fields';
import { CustomerFields } from './customer-fields';
import { ItemsEditor } from './items-editor';
import {
  emptyForm,
  type FormErrors,
  fromOrder,
  hasErrors,
  type OrderFormValues,
  toCreatePayload,
  toPatchPayload,
  validateForm,
} from './order-form-model';

export const MESSAGES = {
  duplicateNumber: 'Já existe um pedido com este número.',
  invalidValue: 'Valor inválido. Confira o campo.',
  invalidData: 'Verifique os campos destacados.',
  noChanges: 'Nenhuma alteração para salvar.',
} as const;

type OrderFormProps =
  | {
      mode: 'create';
      initialOrder?: undefined;
      onSubmit: (payload: CreateOrderPayload) => Promise<void>;
      onCancel?: () => void;
    }
  | {
      mode: 'edit';
      initialOrder: OrderDetail;
      onSubmit: (payload: UpdateOrderPayload) => Promise<void>;
      onCancel?: () => void;
    };

const FIELD_ALIASES: Record<string, keyof OrderFormValues> = {
  'customer.name': 'customerName',
  'customer.document': 'customerDocument',
};

/** Translates the API's field paths into the form's fields, keeping messages in Portuguese. */
function serverErrorsToForm(error: ApiError, values: OrderFormValues): FormErrors {
  const errors: FormErrors = {};
  const itemErrors: NonNullable<FormErrors['itemErrors']> = {};
  for (const { field } of error.errors) {
    const item = /^items\.(\d+)\.(description|priceCents)$/.exec(field);
    if (item) {
      const key = values.items[Number(item[1])]?.key;
      if (key)
        itemErrors[key] = { ...itemErrors[key], [item[2] as 'description']: MESSAGES.invalidValue };
    } else if (field === 'items') {
      errors.items = MESSAGES.invalidValue;
    } else {
      const name = FIELD_ALIASES[field] ?? field.replace(/^deliveryAddress\./, '');
      if (name in values && name !== 'items') {
        (errors as Record<string, string>)[name] = MESSAGES.invalidValue;
      }
    }
  }
  if (Object.keys(itemErrors).length > 0) errors.itemErrors = itemErrors;
  return errors;
}

function OrderFormInner({ mode, initialOrder, onSubmit, onCancel }: OrderFormProps) {
  const initialValues = useRef(initialOrder ? fromOrder(initialOrder) : emptyForm());
  const [values, setValues] = useState<OrderFormValues>(initialValues.current);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formMessage, setFormMessage] = useState<{ kind: 'error' | 'info'; text: string }>();
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  const set = (patch: Partial<OrderFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  // Focus is requested with state so it runs after React rendered the aria-invalid attributes.
  const [focusRequest, setFocusRequest] = useState(0);
  const focusFirstInvalid = () => setFocusRequest((count) => count + 1);
  useEffect(() => {
    if (focusRequest > 0) {
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [focusRequest]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setFormMessage(undefined);

    const clientErrors = validateForm(values);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) {
      focusFirstInvalid();
      return;
    }

    let send: () => Promise<void>;
    if (mode === 'create') {
      const payload = toCreatePayload(values);
      send = () => (onSubmit as (p: CreateOrderPayload) => Promise<void>)(payload);
    } else {
      const patch = toPatchPayload(initialValues.current, values);
      if (!patch) {
        setFormMessage({ kind: 'info', text: MESSAGES.noChanges });
        return;
      }
      send = () => (onSubmit as (p: UpdateOrderPayload) => Promise<void>)(patch);
    }

    submitting.current = true;
    setPending(true);
    try {
      await send();
    } catch (error) {
      // Everything the user typed stays in place; only the explanation changes.
      if (error instanceof ApiError && error.code === 'ORDER_NUMBER_ALREADY_EXISTS') {
        setErrors({ orderNumber: MESSAGES.duplicateNumber });
        focusFirstInvalid();
      } else if (error instanceof ApiError && error.status === 400) {
        setErrors(serverErrorsToForm(error, values));
        setFormMessage({ kind: 'error', text: MESSAGES.invalidData });
        focusFirstInvalid();
      } else {
        setFormMessage({ kind: 'error', text: errorMessage(error) });
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form
      ref={form}
      onSubmit={submit}
      noValidate
      aria-busy={pending}
      aria-label={mode === 'create' ? 'Novo pedido' : 'Editar pedido'}
      className="grid gap-6"
    >
      {formMessage && (
        <p
          role={formMessage.kind === 'error' ? 'alert' : 'status'}
          className={
            formMessage.kind === 'error' ? 'text-destructive font-medium' : 'text-muted-foreground'
          }
        >
          {formMessage.text}
        </p>
      )}
      <fieldset className="grid gap-4 sm:grid-cols-3" disabled={pending}>
        <legend className="mb-2 text-lg font-medium">Pedido</legend>
        <FormField
          id="order-number"
          label="Número do pedido"
          value={values.orderNumber}
          onValueChange={(orderNumber) => set({ orderNumber })}
          error={errors.orderNumber}
        />
        <div className="grid gap-2">
          <Label htmlFor="order-status">Status</Label>
          <select
            id="order-status"
            value={values.status}
            onChange={(event) => set({ status: event.target.value as OrderStatus })}
            className="border-input bg-background focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
          >
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <FormField
          id="order-expected-delivery"
          label="Previsão de entrega"
          type="date"
          value={values.expectedDeliveryDate}
          onValueChange={(expectedDeliveryDate) => set({ expectedDeliveryDate })}
          error={errors.expectedDeliveryDate}
        />
      </fieldset>
      <CustomerFields values={values} errors={errors} onChange={set} disabled={pending} />
      <AddressFields values={values} errors={errors} onChange={set} disabled={pending} />
      <ItemsEditor
        items={values.items}
        errors={errors}
        onChange={(items) => set({ items })}
        disabled={pending}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvando…' : mode === 'create' ? 'Criar pedido' : 'Salvar alterações'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

/**
 * Create or edit form that never calls the API itself: it hands a ready payload to `onSubmit`.
 * The inner form is re-created whenever the order (or its saved version) changes, so values of two
 * different orders can never mix.
 */
export function OrderForm(props: OrderFormProps) {
  const identity = props.initialOrder
    ? `${props.initialOrder.id}:${props.initialOrder.updatedAt}`
    : 'new';
  return <OrderFormInner key={identity} {...props} />;
}

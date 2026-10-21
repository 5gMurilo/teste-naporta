import { FormField } from '@/components/form-field';
import type { FormErrors, OrderFormValues } from './order-form-model';

interface CustomerFieldsProps {
  values: Pick<OrderFormValues, 'customerName' | 'customerDocument'>;
  errors?: Pick<FormErrors, 'customerName' | 'customerDocument'>;
  onChange: (patch: Partial<Pick<OrderFormValues, 'customerName' | 'customerDocument'>>) => void;
  disabled?: boolean;
}

/** The document is free text: no mask and no CPF/CNPJ check, because the API accepts any value. */
export function CustomerFields({
  values,
  errors,
  onChange,
  disabled = false,
}: CustomerFieldsProps) {
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2" disabled={disabled}>
      <legend className="mb-2 text-lg font-medium">Cliente</legend>
      <FormField
        id="customer-name"
        label="Nome do cliente"
        value={values.customerName}
        onValueChange={(customerName) => onChange({ customerName })}
        error={errors?.customerName}
        autoComplete="name"
      />
      <FormField
        id="customer-document"
        label="Documento do cliente"
        value={values.customerDocument}
        onValueChange={(customerDocument) => onChange({ customerDocument })}
        error={errors?.customerDocument}
        autoComplete="off"
      />
    </fieldset>
  );
}

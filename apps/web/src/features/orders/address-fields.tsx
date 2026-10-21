import { FormField } from '@/components/form-field';
import type { FormErrors, OrderFormValues } from './order-form-model';

export const ADDRESS_KEYS = [
  'street',
  'number',
  'complement',
  'neighborhood',
  'city',
  'state',
  'postalCode',
] as const;

type AddressKey = (typeof ADDRESS_KEYS)[number];

interface AddressFieldsProps {
  values: Pick<OrderFormValues, AddressKey>;
  errors?: Pick<FormErrors, AddressKey>;
  onChange: (patch: Partial<Pick<OrderFormValues, AddressKey>>) => void;
  disabled?: boolean;
}

/**
 * The complement may be emptied: an empty value is simply not sent, and because the API replaces
 * the address as a whole, the stored complement disappears with it. The postal code stays text so
 * a leading zero is never lost.
 */
export function AddressFields({ values, errors, onChange, disabled = false }: AddressFieldsProps) {
  return (
    <fieldset className="grid gap-4 sm:grid-cols-2" disabled={disabled}>
      <legend className="mb-2 text-lg font-medium">Endereço de entrega</legend>
      <FormField
        id="address-street"
        label="Rua"
        value={values.street}
        onValueChange={(street) => onChange({ street })}
        error={errors?.street}
        autoComplete="address-line1"
      />
      <FormField
        id="address-number"
        label="Número"
        value={values.number}
        onValueChange={(number) => onChange({ number })}
        error={errors?.number}
      />
      <FormField
        id="address-complement"
        label="Complemento"
        value={values.complement}
        onValueChange={(complement) => onChange({ complement })}
        error={errors?.complement}
        hint="Opcional. Deixe vazio para remover o complemento."
        autoComplete="address-line2"
      />
      <FormField
        id="address-neighborhood"
        label="Bairro"
        value={values.neighborhood}
        onValueChange={(neighborhood) => onChange({ neighborhood })}
        error={errors?.neighborhood}
      />
      <FormField
        id="address-city"
        label="Cidade"
        value={values.city}
        onValueChange={(city) => onChange({ city })}
        error={errors?.city}
        autoComplete="address-level2"
      />
      <FormField
        id="address-state"
        label="UF"
        value={values.state}
        onValueChange={(state) => onChange({ state: state.toUpperCase() })}
        error={errors?.state}
        maxLength={2}
        autoComplete="address-level1"
      />
      <FormField
        id="address-postal-code"
        label="CEP"
        value={values.postalCode}
        onValueChange={(postalCode) => onChange({ postalCode })}
        error={errors?.postalCode}
        hint="Oito dígitos, somente números."
        inputMode="numeric"
        autoComplete="postal-code"
      />
    </fieldset>
  );
}

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ADDRESS_KEYS, AddressFields } from './address-fields';
import type { FormErrors, OrderFormValues } from './order-form-model';

type AddressValues = Pick<OrderFormValues, (typeof ADDRESS_KEYS)[number]>;
const blank: AddressValues = {
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  postalCode: '',
};

function Harness({ initial = blank, errors }: { initial?: AddressValues; errors?: FormErrors }) {
  const [values, setValues] = useState(initial);
  return (
    <>
      <AddressFields
        values={values}
        errors={errors}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
      />
      <output aria-label="estado">{JSON.stringify(values)}</output>
    </>
  );
}

const state = () =>
  JSON.parse(screen.getByLabelText('estado').textContent ?? '{}') as AddressValues;

describe('AddressFields (U32, U35)', () => {
  it('edits every address field through its label', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('Rua'), 'Rua das Flores');
    await user.type(screen.getByLabelText('Número'), '101');
    await user.type(screen.getByLabelText('Complemento'), 'Apto 12');
    await user.type(screen.getByLabelText('Bairro'), 'Centro');
    await user.type(screen.getByLabelText('Cidade'), 'São Paulo');
    await user.type(screen.getByLabelText('UF'), 'sp');
    await user.type(screen.getByLabelText('CEP'), '01001000');

    expect(state()).toEqual({
      street: 'Rua das Flores',
      number: '101',
      complement: 'Apto 12',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01001000',
    });
    expect(screen.getByRole('group', { name: 'Endereço de entrega' })).toBeInTheDocument();
  });

  it('uppercases the UF as typed and limits it to two characters', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('UF'), 'rjx');

    expect(screen.getByLabelText('UF')).toHaveValue('RJ');
  });

  it('keeps the postal code as text, preserving a leading zero', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('CEP'), '01001000');

    expect(screen.getByLabelText('CEP')).toHaveValue('01001000');
    expect(screen.getByLabelText('CEP')).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByLabelText('CEP')).not.toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('CEP')).toHaveAccessibleDescription(
      'Oito dígitos, somente números.',
    );
  });

  it('lets the complement be removed and explains that it is optional', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...blank, complement: 'Apto 12' }} />);

    expect(screen.getByLabelText('Complemento')).toHaveAccessibleDescription(
      'Opcional. Deixe vazio para remover o complemento.',
    );
    await user.clear(screen.getByLabelText('Complemento'));

    expect(state().complement).toBe('');
  });

  it('associates errors with their fields and replaces the hint while an error is shown', () => {
    render(<Harness errors={{ street: 'Campo obrigatório.', postalCode: 'CEP inválido.' }} />);

    expect(screen.getByLabelText('Rua')).toHaveAccessibleDescription('Campo obrigatório.');
    expect(screen.getByLabelText('CEP')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('CEP')).toHaveAccessibleDescription('CEP inválido.');
    expect(screen.getByLabelText('Cidade')).not.toHaveAttribute('aria-invalid');
  });

  it('follows the visual order with the keyboard', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const order: string[] = [];
    for (let step = 0; step < 7; step += 1) {
      await user.tab();
      order.push((document.activeElement as HTMLInputElement).id);
    }

    expect(order).toEqual([
      'address-street',
      'address-number',
      'address-complement',
      'address-neighborhood',
      'address-city',
      'address-state',
      'address-postal-code',
    ]);
  });
});

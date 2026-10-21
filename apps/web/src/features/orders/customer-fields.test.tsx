import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CustomerFields } from './customer-fields';
import type { FormErrors } from './order-form-model';

function Harness({ errors }: { errors?: FormErrors }) {
  const [values, setValues] = useState({ customerName: '', customerDocument: '' });
  return (
    <>
      <CustomerFields
        values={values}
        errors={errors}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
      />
      <output aria-label="estado">{JSON.stringify(values)}</output>
    </>
  );
}

describe('CustomerFields (U32, U35)', () => {
  it('edits the name and the document through their labels', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('Nome do cliente'), 'Ana Silva');
    await user.type(screen.getByLabelText('Documento do cliente'), 'DOC-77');

    expect(screen.getByLabelText('estado')).toHaveTextContent(
      '{"customerName":"Ana Silva","customerDocument":"DOC-77"}',
    );
    expect(screen.getByRole('group', { name: 'Cliente' })).toBeInTheDocument();
  });

  it('keeps a generic document exactly as typed: no mask, no CPF or CNPJ algorithm', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByLabelText('Documento do cliente'), 'abc 123.456/78-9');

    expect(screen.getByLabelText('Documento do cliente')).toHaveValue('abc 123.456/78-9');
    expect(screen.getByLabelText('Documento do cliente')).not.toHaveAttribute('aria-invalid');
  });

  it('never logs the typed document', async () => {
    const user = userEvent.setup();
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );
    render(<Harness />);

    await user.type(screen.getByLabelText('Documento do cliente'), 'SEGREDO-123');

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('ties each error message to its own field for assistive technology', () => {
    render(
      <Harness
        errors={{ customerName: 'Campo obrigatório.', customerDocument: 'Documento inválido.' }}
      />,
    );

    expect(screen.getByLabelText('Nome do cliente')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Nome do cliente')).toHaveAccessibleDescription(
      'Campo obrigatório.',
    );
    expect(screen.getByLabelText('Documento do cliente')).toHaveAccessibleDescription(
      'Documento inválido.',
    );
  });

  it('disables both inputs together while the form is busy', () => {
    render(
      <CustomerFields
        values={{ customerName: 'A', customerDocument: 'B' }}
        onChange={() => undefined}
        disabled
      />,
    );

    expect(screen.getByLabelText('Nome do cliente')).toBeDisabled();
    expect(screen.getByLabelText('Documento do cliente')).toBeDisabled();
  });
});

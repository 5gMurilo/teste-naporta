import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ItemsEditor, MAX_ITEMS } from './items-editor';
import { emptyItem, type FormErrors, type ItemDraft } from './order-form-model';

function Harness({
  initial,
  errors,
  onItems,
}: {
  initial: ItemDraft[];
  errors?: FormErrors;
  onItems?: (items: ItemDraft[]) => void;
}) {
  const [items, setItems] = useState(initial);
  return (
    <ItemsEditor
      items={items}
      errors={errors}
      onChange={(next) => {
        setItems(next);
        onItems?.(next);
      }}
    />
  );
}

const item = (key: string, description = '', priceCents = ''): ItemDraft => ({
  key,
  description,
  priceCents,
});

describe('ItemsEditor (U32, U34, U35)', () => {
  it('labels every field by its position and exposes a removal button per item', () => {
    render(<Harness initial={[item('a', 'Café', '4990'), item('b', 'Caneca', '0')]} />);

    expect(screen.getByLabelText('Descrição do item 1')).toHaveValue('Café');
    expect(screen.getByLabelText('Preço do item 2 (centavos)')).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Remover item 1' })).toBeEnabled();
    expect(screen.getByRole('group', { name: 'Itens' })).toBeInTheDocument();
    expect(screen.getByLabelText('Preço do item 1 (centavos)')).toHaveAccessibleDescription(
      'Ex.: 4990 = R$ 49,90',
    );
  });

  it('adds an item and moves focus to its description', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[item('a', 'Café', '1')]} />);

    await user.click(screen.getByRole('button', { name: 'Adicionar item' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByLabelText('Descrição do item 2')).toHaveFocus();
  });

  it('keeps the same input elements, and focus, while typing and while other rows change', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[item('a', '', ''), item('b', '', '')]} />);
    const first = screen.getByLabelText('Descrição do item 1');

    await user.type(first, 'Café');
    await user.click(screen.getByRole('button', { name: 'Adicionar item' }));

    expect(screen.getByLabelText('Descrição do item 1')).toBe(first);
    expect(first).toHaveValue('Café');
  });

  it('removes an item, keeps the others intact, and focuses the row that took its place', async () => {
    const user = userEvent.setup();
    let latest: ItemDraft[] = [];
    render(
      <Harness
        initial={[item('a', 'A', '1'), item('b', 'B', '2'), item('c', 'C', '3')]}
        onItems={(next) => {
          latest = next;
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Remover item 2' }));

    expect(latest.map((entry) => entry.description)).toEqual(['A', 'C']);
    expect(screen.getByLabelText('Descrição do item 2')).toHaveValue('C');
    expect(screen.getByLabelText('Descrição do item 2')).toHaveFocus();
  });

  it('focuses the previous row when the last one is removed', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[item('a', 'A', '1'), item('b', 'B', '2')]} />);

    await user.click(screen.getByRole('button', { name: 'Remover item 2' }));

    expect(screen.getByLabelText('Descrição do item 1')).toHaveFocus();
  });

  it('never allows removing the last remaining item', () => {
    render(<Harness initial={[item('a', 'A', '1')]} />);

    expect(screen.getByRole('button', { name: 'Remover item 1' })).toBeDisabled();
  });

  it(`stops adding at ${MAX_ITEMS} items and says why`, () => {
    const full = Array.from({ length: MAX_ITEMS }, () => emptyItem());
    render(<Harness initial={full} />);

    expect(screen.getByRole('button', { name: 'Adicionar item' })).toBeDisabled();
    expect(screen.getByText(`Limite de ${MAX_ITEMS} itens atingido.`)).toBeInTheDocument();
  });

  it('accepts a zero price as plain text and rejects nothing by itself', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[item('a')]} />);

    await user.type(screen.getByLabelText('Preço do item 1 (centavos)'), '0');

    expect(screen.getByLabelText('Preço do item 1 (centavos)')).toHaveValue('0');
    expect(screen.getByLabelText('Preço do item 1 (centavos)')).not.toHaveAttribute('aria-invalid');
  });

  it('associates field errors with their inputs and announces the collection error', () => {
    const errors: FormErrors = {
      itemErrors: {
        b: {
          description: 'Campo obrigatório.',
          priceCents: 'Informe o preço em centavos, apenas números inteiros.',
        },
      },
      items: 'Informe pelo menos um item.',
    };
    render(<Harness initial={[item('a', 'ok', '1'), item('b', '', 'x')]} errors={errors} />);

    const description = screen.getByLabelText('Descrição do item 2');
    const price = screen.getByLabelText('Preço do item 2 (centavos)');
    expect(description).toHaveAttribute('aria-invalid', 'true');
    expect(description).toHaveAccessibleDescription('Campo obrigatório.');
    expect(price).toHaveAccessibleDescription(
      'Informe o preço em centavos, apenas números inteiros.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Informe pelo menos um item.');
    expect(
      within(screen.getAllByRole('listitem')[0] as HTMLElement).queryByText('Campo obrigatório.'),
    ).toBeNull();
  });

  it('supports keyboard-only operation of add and remove', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[item('a', 'A', '1'), item('b', 'B', '2')]} />);
    const add = screen.getByRole('button', { name: 'Adicionar item' });

    add.focus();
    await user.keyboard('{Enter}');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByLabelText('Descrição do item 3')).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Remover item 3' })).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

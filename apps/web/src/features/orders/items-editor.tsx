import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { emptyItem, type FormErrors, type ItemDraft } from './order-form-model';

export const MIN_ITEMS = 1;
export const MAX_ITEMS = 50;

interface ItemsEditorProps {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  errors?: Pick<FormErrors, 'items' | 'itemErrors'>;
  disabled?: boolean;
}

/** Edits the 1..50 items of an order. Rows keep a stable key, so typing never loses focus. */
export function ItemsEditor({ items, onChange, errors, disabled = false }: ItemsEditorProps) {
  const descriptionInputs = useRef(new Map<string, HTMLInputElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const focusAfterRender = useRef<{ key: string } | { add: true } | null>(null);

  // Focus is moved after the new row exists in the DOM.
  useEffect(() => {
    const target = focusAfterRender.current;
    focusAfterRender.current = null;
    if (!target) return;
    if ('key' in target) descriptionInputs.current.get(target.key)?.focus();
    else addButton.current?.focus();
  }, [items]);

  function update(key: string, patch: Partial<ItemDraft>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function add() {
    const item = emptyItem();
    focusAfterRender.current = { key: item.key };
    onChange([...items, item]);
  }

  function remove(index: number) {
    const next = items.filter((_, position) => position !== index);
    const neighbour = next[index] ?? next[index - 1];
    focusAfterRender.current = neighbour ? { key: neighbour.key } : { add: true };
    onChange(next);
  }

  return (
    <fieldset className="grid gap-4" disabled={disabled}>
      <legend className="text-lg font-medium">Itens</legend>
      {errors?.items && (
        <p role="alert" className="text-destructive text-sm">
          {errors.items}
        </p>
      )}
      <ul className="grid gap-4">
        {items.map((item, index) => {
          const number = index + 1;
          const problems = errors?.itemErrors?.[item.key];
          const descriptionId = `item-${item.key}-description`;
          const priceId = `item-${item.key}-price`;
          return (
            <li
              key={item.key}
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_12rem_auto]"
            >
              <div className="grid gap-2">
                <Label htmlFor={descriptionId}>Descrição do item {number}</Label>
                <Input
                  id={descriptionId}
                  ref={(element) => {
                    if (element) descriptionInputs.current.set(item.key, element);
                    else descriptionInputs.current.delete(item.key);
                  }}
                  value={item.description}
                  onChange={(event) => update(item.key, { description: event.target.value })}
                  aria-invalid={problems?.description ? true : undefined}
                  aria-describedby={problems?.description ? `${descriptionId}-error` : undefined}
                />
                {problems?.description && (
                  <p id={`${descriptionId}-error`} className="text-destructive text-sm">
                    {problems.description}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor={priceId}>Preço do item {number} (centavos)</Label>
                <Input
                  id={priceId}
                  inputMode="numeric"
                  value={item.priceCents}
                  onChange={(event) => update(item.key, { priceCents: event.target.value })}
                  aria-invalid={problems?.priceCents ? true : undefined}
                  aria-describedby={problems?.priceCents ? `${priceId}-error` : `${priceId}-hint`}
                />
                {problems?.priceCents ? (
                  <p id={`${priceId}-error`} className="text-destructive text-sm">
                    {problems.priceCents}
                  </p>
                ) : (
                  <p id={`${priceId}-hint`} className="text-muted-foreground text-xs">
                    Ex.: 4990 = R$ 49,90
                  </p>
                )}
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Remover item ${number}`}
                  disabled={items.length <= MIN_ITEMS}
                  onClick={() => remove(index)}
                >
                  Remover
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <div>
        <Button
          ref={addButton}
          type="button"
          variant="outline"
          disabled={items.length >= MAX_ITEMS}
          onClick={add}
        >
          Adicionar item
        </Button>
        {items.length >= MAX_ITEMS && (
          <p className="text-muted-foreground mt-2 text-sm">
            Limite de {MAX_ITEMS} itens atingido.
          </p>
        )}
      </div>
    </fieldset>
  );
}

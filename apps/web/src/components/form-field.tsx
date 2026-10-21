import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormFieldProps extends Omit<ComponentProps<typeof Input>, 'onChange' | 'value' | 'id'> {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  hint?: string;
}

/** A labelled input whose error and hint are announced together with the field. */
export function FormField({
  id,
  label,
  value,
  onValueChange,
  error,
  hint,
  ...rest
}: FormFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        {...rest}
        id={id}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-muted-foreground text-xs">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

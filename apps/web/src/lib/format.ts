/**
 * Civil dates (YYYY-MM-DD) are plain calendar days: they are rearranged as text and never go
 * through `Date`, so the browser's time zone cannot shift them by a day.
 */
export function formatCivilDate(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

const instantFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** UTC instants are shown in the viewer's local time, which is what a timestamp should mean. */
export function formatInstant(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : instantFormat.format(date);
}

export const STATUS_LABELS = {
  PENDING: 'Pendente',
  PROCESSING: 'Em processamento',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelado',
} as const;

const integerFormat = new Intl.NumberFormat('pt-BR');

/**
 * Cents to "R$ 49,90" with integer arithmetic only, so large totals keep every cent and no float
 * rounding can appear.
 */
export function formatBRL(cents: number): string {
  const reais = Math.floor(cents / 100);
  const rest = String(cents % 100).padStart(2, '0');
  return `R$ ${integerFormat.format(reais)},${rest}`;
}

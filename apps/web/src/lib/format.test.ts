import { describe, expect, it } from 'vitest';
import { formatBRL, formatCivilDate, formatInstant, STATUS_LABELS } from './format';

describe('formatBRL (U35)', () => {
  it.each([
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [4990, 'R$ 49,90'],
    [100, 'R$ 1,00'],
    [123456789, 'R$ 1.234.567,89'],
    [100_000_000_000, 'R$ 1.000.000.000,00'],
    [2_000_000_001, 'R$ 20.000.000,01'],
  ])('formats %i cents as %s', (cents, expected) => {
    expect(formatBRL(cents)).toBe(expected);
  });
});

describe('formatCivilDate (U35)', () => {
  it.each(['UTC', 'America/Sao_Paulo', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
    'keeps 2026-11-03 as 03/11/2026 under TZ=%s',
    (zone) => {
      const previous = process.env.TZ;
      process.env.TZ = zone;
      try {
        expect(formatCivilDate('2026-11-03')).toBe('03/11/2026');
        expect(formatCivilDate('2026-01-01')).toBe('01/01/2026');
      } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
      }
    },
  );

  it('returns an unexpected value untouched instead of guessing', () => {
    expect(formatCivilDate('not a date')).toBe('not a date');
  });
});

describe('formatInstant and labels', () => {
  it('formats a UTC instant and leaves garbage untouched', () => {
    expect(formatInstant('2026-10-21T15:30:00.000Z')).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(formatInstant('garbage')).toBe('garbage');
  });

  it('labels every status in Portuguese', () => {
    expect(Object.values(STATUS_LABELS)).toEqual([
      'Pendente',
      'Em processamento',
      'Enviado',
      'Entregue',
      'Cancelado',
    ]);
  });
});

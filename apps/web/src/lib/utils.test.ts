import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins truthy class names and lets later Tailwind utilities win', () => {
    expect(cn('px-2', false && 'hidden', 'px-4', undefined, 'font-bold')).toBe('px-4 font-bold');
  });
});

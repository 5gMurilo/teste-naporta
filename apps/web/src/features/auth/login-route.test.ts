import { describe, expect, it } from 'vitest';
import { safeRedirect } from './login-route';

describe('safeRedirect', () => {
  it.each([
    ['/orders', '/orders'],
    ['/orders/6c0b1c32?x=1', '/orders/6c0b1c32?x=1'],
    ['/login', '/orders'],
    ['/login?x=1', '/orders'],
    ['//evil.example', '/orders'],
    ['/\\evil.example', '/orders'],
    ['https://evil.example', '/orders'],
    ['orders', '/orders'],
    [undefined, '/orders'],
    [42, '/orders'],
    [null, '/orders'],
  ])('maps %s to %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
});

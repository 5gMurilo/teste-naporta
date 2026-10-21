import type { ValidationError } from '@nestjs/common';
import {
  RequestValidationException,
  schemaExceptionFactory,
  validationExceptionFactory,
} from './validation.exception.js';

describe('validationExceptionFactory (class-validator)', () => {
  it('flattens nested constraints into dotted field paths without input values', () => {
    const errors = [
      { property: 'email', constraints: { isEmail: 'email must be an email' } },
      {
        property: 'address',
        children: [
          {
            property: 'zip',
            constraints: { isString: 'zip must be a string', min: 'zip too short' },
          },
        ],
      },
    ] as ValidationError[];

    const exception = validationExceptionFactory(errors);

    expect(exception).toBeInstanceOf(RequestValidationException);
    expect(exception.getStatus()).toBe(400);
    expect(exception.errors).toEqual([
      { field: 'email', message: 'email must be an email' },
      { field: 'address.zip', message: 'zip must be a string' },
      { field: 'address.zip', message: 'zip too short' },
    ]);
  });
});

describe('schemaExceptionFactory (Standard Schema)', () => {
  it('maps property keys, object keys, and indexes into field paths', () => {
    const exception = schemaExceptionFactory([
      { message: 'bad name', path: ['customer', { key: 'name' }] },
      { message: 'bad item', path: ['items', 2, 'priceCents'] },
    ]);

    expect(exception.errors).toEqual([
      { field: 'customer.name', message: 'bad name' },
      { field: 'items.2.priceCents', message: 'bad item' },
    ]);
  });

  it('uses body as the field for root level issues', () => {
    expect(schemaExceptionFactory([{ message: 'unknown key' }]).errors).toEqual([
      { field: 'body', message: 'unknown key' },
    ]);
    expect(schemaExceptionFactory([{ message: 'x', path: [] }]).errors[0]?.field).toBe('body');
  });
});

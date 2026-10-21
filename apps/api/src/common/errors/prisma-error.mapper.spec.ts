import { Prisma } from '../../generated/prisma/client.js';
import { OrderNumberAlreadyExistsError } from './domain-errors.js';
import { mapPrismaError, ORDER_NUMBER_CONSTRAINT } from './prisma-error.mapper.js';

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('driver message with SELECT secret', {
    code,
    clientVersion: 'test',
    meta,
  });
}

function uniqueViolation(index: string, kind = 'UniqueConstraintViolation') {
  return {
    driverAdapterError: { name: 'DriverAdapterError', cause: { kind, constraint: { index } } },
  };
}

describe('mapPrismaError', () => {
  it('maps a P2002 on the orderNumber unique index to the domain error without driver details', () => {
    const mapped = mapPrismaError(knownError('P2002', uniqueViolation(ORDER_NUMBER_CONSTRAINT)));

    expect(mapped).toBeInstanceOf(OrderNumberAlreadyExistsError);
    expect((mapped as OrderNumberAlreadyExistsError).code).toBe('ORDER_NUMBER_ALREADY_EXISTS');
    expect((mapped as Error).message).not.toContain('SELECT');
  });

  it('keeps a P2002 on another unique index, such as user email, as the original error', () => {
    const original = knownError('P2002', uniqueViolation('User_email_key'));

    expect(mapPrismaError(original)).toBe(original);
  });

  it('keeps other Prisma codes untouched even when they mention the orderNumber index', () => {
    const original = knownError('P2003', uniqueViolation(ORDER_NUMBER_CONSTRAINT));

    expect(mapPrismaError(original)).toBe(original);
  });

  it('does not treat a non unique violation kind or missing metadata as a conflict', () => {
    const wrongKind = knownError('P2002', uniqueViolation(ORDER_NUMBER_CONSTRAINT, 'Other'));
    const noMeta = knownError('P2002');

    expect(mapPrismaError(wrongKind)).toBe(wrongKind);
    expect(mapPrismaError(noMeta)).toBe(noMeta);
  });

  it('returns unknown values and look-alike objects unchanged', () => {
    const lookAlike = { code: 'P2002', meta: uniqueViolation(ORDER_NUMBER_CONSTRAINT) };
    const plain = new Error('boom');

    expect(mapPrismaError(lookAlike)).toBe(lookAlike);
    expect(mapPrismaError(plain)).toBe(plain);
    expect(mapPrismaError(undefined)).toBeUndefined();
    expect(mapPrismaError('text')).toBe('text');
  });
});

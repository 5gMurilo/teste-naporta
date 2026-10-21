import { Prisma } from '../../generated/prisma/client.js';
import { OrderNumberAlreadyExistsError } from './domain-errors.js';

export const ORDER_NUMBER_CONSTRAINT = 'Order_orderNumber_key';

function violatedIndex(error: Prisma.PrismaClientKnownRequestError): unknown {
  const adapterError = error.meta?.driverAdapterError as
    | { cause?: { kind?: unknown; constraint?: { index?: unknown } } }
    | undefined;
  const cause = adapterError?.cause;
  return cause?.kind === 'UniqueConstraintViolation' ? cause.constraint?.index : undefined;
}

/**
 * Translates only the known orderNumber unique violation into a domain error.
 * Every other failure, including other unique constraints, is returned untouched.
 */
export function mapPrismaError(error: unknown): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    violatedIndex(error) === ORDER_NUMBER_CONSTRAINT
  ) {
    return new OrderNumberAlreadyExistsError();
  }
  return error;
}

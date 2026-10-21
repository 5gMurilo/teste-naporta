import { BadRequestException, type ValidationError } from '@nestjs/common';

export type FieldError = { field: string; message: string };

export class RequestValidationException extends BadRequestException {
  constructor(readonly errors: FieldError[]) {
    super('Validation failed');
  }
}

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({ field, message }));
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

export function validationExceptionFactory(errors: ValidationError[]): RequestValidationException {
  return new RequestValidationException(flatten(errors));
}

import {
  BadRequestException,
  type StandardSchemaValidationPipeOptions,
  type ValidationError,
} from '@nestjs/common';

type SchemaIssues = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>
>[0];
type SchemaIssue = SchemaIssues[number];

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

function pathOf(issue: SchemaIssue): string {
  const segments = (issue.path ?? []).map((segment) =>
    String(typeof segment === 'object' ? segment.key : segment),
  );
  return segments.length > 0 ? segments.join('.') : 'body';
}

export function schemaExceptionFactory(issues: SchemaIssues): RequestValidationException {
  return new RequestValidationException(
    issues.map((issue) => ({ field: pathOf(issue), message: issue.message })),
  );
}

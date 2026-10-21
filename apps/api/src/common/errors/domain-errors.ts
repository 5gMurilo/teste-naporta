export abstract class DomainError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
  abstract readonly detail: string;
}

export class OrderNumberAlreadyExistsError extends DomainError {
  readonly status = 409;
  readonly code = 'ORDER_NUMBER_ALREADY_EXISTS';
  readonly detail = 'An order with this order number already exists.';

  constructor() {
    super('Order number already exists');
    this.name = 'OrderNumberAlreadyExistsError';
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly status = 401;
  readonly code = 'INVALID_CREDENTIALS';
  readonly detail = 'Invalid email or password.';

  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

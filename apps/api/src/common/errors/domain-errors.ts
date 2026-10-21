export class OrderNumberAlreadyExistsError extends Error {
  readonly code = 'ORDER_NUMBER_ALREADY_EXISTS';

  constructor() {
    super('Order number already exists');
    this.name = 'OrderNumberAlreadyExistsError';
  }
}

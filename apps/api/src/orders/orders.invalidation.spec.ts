import { jest } from '@jest/globals';
import type { OrdersDetailCache } from '../cache/orders-detail.cache.js';
import {
  OrderNotFoundError,
  OrderNumberAlreadyExistsError,
} from '../common/errors/domain-errors.js';
import type { OrderDetailModel } from './orders.projections.js';
import type { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';

const ID = '6c0b1c32-8b4d-4f43-8c1b-0d4cf4fd7a6b';

function setup(patchActive: () => Promise<OrderDetailModel>) {
  const events: string[] = [];
  const repository = {
    patchActive: jest.fn(async () => {
      events.push('transaction-start');
      try {
        return await patchActive();
      } finally {
        events.push('transaction-end');
      }
    }),
  };
  const cache = {
    invalidate: jest.fn(async (_id: string) => {
      events.push('invalidate');
    }),
  };
  const service = new OrdersService(
    repository as unknown as OrdersRepository,
    cache as unknown as OrdersDetailCache,
  );
  return { service, cache, events };
}

describe('OrdersService.patch cache invalidation (U26)', () => {
  it('deletes the cache entry only after the transaction finished, then returns the order', async () => {
    const order = { id: ID } as OrderDetailModel;
    const { service, cache, events } = setup(async () => order);

    await expect(service.patch(ID, { status: 'SHIPPED' })).resolves.toBe(order);

    expect(cache.invalidate).toHaveBeenCalledWith(ID);
    expect(events).toEqual(['transaction-start', 'transaction-end', 'invalidate']);
  });

  it.each([
    ['rollback (unexpected failure)', () => new Error('item insert failed')],
    ['not found', () => new OrderNotFoundError()],
    ['order number conflict', () => new OrderNumberAlreadyExistsError()],
  ])('does not invalidate after %s', async (_name, failure) => {
    const { service, cache, events } = setup(async () => Promise.reject(failure()));

    await expect(service.patch(ID, { status: 'SHIPPED' })).rejects.toBeDefined();

    expect(cache.invalidate).not.toHaveBeenCalled();
    expect(events).toEqual(['transaction-start', 'transaction-end']);
  });
});

describe('OrdersService.delete cache invalidation (U26, U27)', () => {
  function deleteSetup(result: boolean | Error) {
    const events: string[] = [];
    const repository = {
      softDeleteActive: jest.fn(async () => {
        events.push('update');
        if (result instanceof Error) throw result;
        return result;
      }),
    };
    const cache = {
      invalidate: jest.fn(async (_id: string) => {
        events.push('invalidate');
      }),
    };
    const service = new OrdersService(
      repository as unknown as OrdersRepository,
      cache as unknown as OrdersDetailCache,
    );
    return { service, cache, events };
  }

  it('deletes the entry after the committed soft delete', async () => {
    const { service, cache, events } = deleteSetup(true);

    await service.delete(ID);

    expect(cache.invalidate).toHaveBeenCalledWith(ID);
    expect(events).toEqual(['update', 'invalidate']);
  });

  it.each([
    ['an order that is missing or already deleted', false],
    ['a database failure', new Error('connection lost')],
  ])('does not touch the cache for %s', async (_name, outcome) => {
    const { service, cache } = deleteSetup(outcome);

    await expect(service.delete(ID)).rejects.toBeDefined();

    expect(cache.invalidate).not.toHaveBeenCalled();
  });
});

import { Injectable } from '@nestjs/common';
import { OrdersDetailCache } from '../cache/orders-detail.cache.js';
import { OrderNotFoundError } from '../common/errors/domain-errors.js';
import { mapPrismaError } from '../common/errors/prisma-error.mapper.js';
import type {
  OrderDetailModel,
  OrderSnapshotModel,
  OrderSummaryModel,
} from './orders.projections.js';
import { OrdersRepository } from './orders.repository.js';
import type {
  CreateOrderRequest,
  ListOrdersQuery,
  UpdateOrderRequest,
} from './schemas/orders.schemas.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly cache: OrdersDetailCache,
  ) {}

  async create(request: CreateOrderRequest): Promise<OrderDetailModel> {
    try {
      return await this.repository.create({ ...request, status: request.status ?? 'PENDING' });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async getActiveSnapshot(id: string): Promise<OrderSnapshotModel> {
    const order = await this.repository.findActiveSnapshot(id);
    if (!order) throw new OrderNotFoundError();
    return order;
  }

  list(query: ListOrdersQuery): Promise<{ orders: OrderSummaryModel[]; total: number }> {
    return this.repository.list(query);
  }

  async patch(id: string, changes: UpdateOrderRequest): Promise<OrderDetailModel> {
    let order: OrderDetailModel;
    try {
      order = await this.repository.patchActive(id, changes);
    } catch (error) {
      throw mapPrismaError(error);
    }
    // Only after the transaction committed, and never inside it: the entry is already stale at
    // this point (its revision is behind), so a failed DEL costs hit rate, not correctness.
    await this.cache.invalidate(id);
    return order;
  }

  async delete(id: string): Promise<void> {
    if (!(await this.repository.softDeleteActive(id))) throw new OrderNotFoundError();
    // After the update committed; a failed DEL is harmless because the detail reader confirms the
    // order is still active in PostgreSQL before it ever looks at the cache.
    await this.cache.invalidate(id);
  }

  /** Active existence and revision; the answer that decides whether a cached detail may be served. */
  async getActiveRevision(id: string): Promise<number> {
    const revision = await this.repository.findActiveRevision(id);
    if (revision === null) throw new OrderNotFoundError();
    return revision;
  }
}

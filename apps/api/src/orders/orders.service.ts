import { Injectable } from '@nestjs/common';
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
  constructor(private readonly repository: OrdersRepository) {}

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
    try {
      return await this.repository.patchActive(id, changes);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async delete(id: string): Promise<void> {
    if (!(await this.repository.softDeleteActive(id))) throw new OrderNotFoundError();
  }
}

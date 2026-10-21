import { Injectable } from '@nestjs/common';
import { OrderNotFoundError } from '../common/errors/domain-errors.js';
import { mapPrismaError } from '../common/errors/prisma-error.mapper.js';
import type { OrderDetailModel, OrderSnapshotModel } from './orders.projections.js';
import { OrdersRepository } from './orders.repository.js';
import type { CreateOrderRequest } from './schemas/orders.schemas.js';

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
}

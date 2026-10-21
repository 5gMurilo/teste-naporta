import { Injectable } from '@nestjs/common';
import { OrdersDetailCache } from '../cache/orders-detail.cache.js';
import { OrderPresenter } from './dto/order.presenter.js';
import type { OrderResponse } from './dto/order.responses.js';
import { OrdersService } from './orders.service.js';

/**
 * Cache-aside read of an order detail. PostgreSQL stays the source of truth: every read first
 * confirms that the order is active and learns its current revision, and a cached entry is only
 * served when it was built from exactly that revision. A stale, foreign, or corrupt entry is
 * ignored, so cache failures and late cache writes can never show outdated or deleted data.
 */
@Injectable()
export class OrdersDetailReader {
  constructor(
    private readonly orders: OrdersService,
    private readonly cache: OrdersDetailCache,
  ) {}

  async read(id: string): Promise<OrderResponse> {
    const revision = await this.orders.getActiveRevision(id);

    const cached = await this.cache.get(id, revision);
    if (cached) return cached;

    // The cache entry is keyed to the revision of this very snapshot, not the one checked above:
    // a write may have landed in between, and the snapshot is what the response is built from.
    const snapshot = await this.orders.getActiveSnapshot(id);
    const detail = OrderPresenter.detail(snapshot);
    await this.cache.put(id, snapshot.cacheRevision, detail);
    return detail;
  }
}

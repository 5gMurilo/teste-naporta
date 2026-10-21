import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { API_CONFIG, type ApiConfig } from '../config/env.js';
import { type OrderResponse, orderResponseSchema } from '../orders/dto/order.responses.js';
import { RedisService } from './redis.service.js';

export const cacheKey = (orderId: string) => `naporta:v1:orders:${orderId}:detail`;

/** Stored payload: the public DTO plus the internal revision it was built from. */
const entrySchema = z.strictObject({
  revision: z.number().int().min(1),
  data: orderResponseSchema,
});

export interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
}

/**
 * Cache-aside storage for order details only. It is an optimization: every failure (Redis down,
 * timeout, corrupt payload) is absorbed and reported as a miss, so callers always fall back to
 * PostgreSQL. Counters carry no payloads, keys, or ids.
 */
@Injectable()
export class OrdersDetailCache {
  private readonly counters: CacheStats = { hits: 0, misses: 0, errors: 0 };

  constructor(
    private readonly redis: RedisService,
    @Inject(API_CONFIG) private readonly config: Pick<ApiConfig, 'CACHE_TTL_SECONDS'>,
  ) {}

  get stats(): Readonly<CacheStats> {
    return { ...this.counters };
  }

  /** Returns the cached detail only when it was built from exactly `revision`. */
  async get(orderId: string, revision: number): Promise<OrderResponse | null> {
    let raw: string | null;
    try {
      raw = await this.redis.get(cacheKey(orderId));
    } catch {
      this.counters.errors += 1;
      return null;
    }
    if (raw === null) {
      this.counters.misses += 1;
      return null;
    }
    const entry = this.decode(raw, orderId);
    if (!entry) {
      this.counters.errors += 1;
      return null;
    }
    if (entry.revision !== revision) {
      this.counters.misses += 1;
      return null;
    }
    this.counters.hits += 1;
    return entry.data;
  }

  async put(orderId: string, revision: number, data: OrderResponse): Promise<void> {
    try {
      const payload = JSON.stringify({ revision, data });
      await this.redis.set(cacheKey(orderId), payload, this.config.CACHE_TTL_SECONDS);
    } catch {
      this.counters.errors += 1;
    }
  }

  async invalidate(orderId: string): Promise<void> {
    try {
      await this.redis.del(cacheKey(orderId));
    } catch {
      this.counters.errors += 1;
    }
  }

  private decode(raw: string, orderId: string): z.infer<typeof entrySchema> | undefined {
    try {
      const entry = entrySchema.parse(JSON.parse(raw));
      return entry.data.id === orderId ? entry : undefined;
    } catch {
      return undefined;
    }
  }
}

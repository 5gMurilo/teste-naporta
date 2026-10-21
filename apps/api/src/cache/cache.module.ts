import { Global, Module } from '@nestjs/common';
import { createClient } from 'redis';
import { API_CONFIG, type ApiConfig } from '../config/env.js';
import { OrdersDetailCache } from './orders-detail.cache.js';
import { REDIS_CLIENT, type RedisClientLike, RedisService } from './redis.service.js';

const MAX_RECONNECT_DELAY_MS = 2000;
const MAX_QUEUED_COMMANDS = 100;

/** Builds the node-redis client with every wait bounded by `CACHE_TIMEOUT_MS`. */
export function createRedisClient(config: ApiConfig): RedisClientLike {
  return createClient({
    url: config.REDIS_URL,
    // Reject commands while disconnected instead of queueing them for a later reconnection.
    disableOfflineQueue: true,
    // Deadline for commands still waiting to be written; in-flight ones are bounded by RedisService.
    commandOptions: { timeout: config.CACHE_TIMEOUT_MS },
    // A stalled server cannot grow the in-memory queue without limit.
    commandsQueueMaxLength: MAX_QUEUED_COMMANDS,
    socket: {
      connectTimeout: config.CACHE_TIMEOUT_MS,
      reconnectStrategy: (retries) =>
        Math.min(2 ** retries * 50, MAX_RECONNECT_DELAY_MS) + Math.floor(Math.random() * 100),
    },
  }) as unknown as RedisClientLike;
}

@Global()
@Module({
  providers: [
    { provide: REDIS_CLIENT, useFactory: createRedisClient, inject: [API_CONFIG] },
    RedisService,
    OrdersDetailCache,
  ],
  exports: [RedisService, OrdersDetailCache],
})
export class CacheModule {}

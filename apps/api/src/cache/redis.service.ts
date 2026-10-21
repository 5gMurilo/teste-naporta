import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { API_CONFIG, type ApiConfig } from '../config/env.js';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/** The small slice of node-redis the application uses; keeps the service testable without a server. */
export interface RedisClientLike {
  readonly isReady: boolean;
  on(event: 'error', listener: (error: Error) => void): unknown;
  connect(): Promise<unknown>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: { EX: number }): Promise<unknown>;
  del(key: string): Promise<number>;
  destroy(): void;
}

export class RedisUnavailableError extends Error {
  constructor() {
    super('Redis is not ready');
    this.name = 'RedisUnavailableError';
  }
}

export class RedisTimeoutError extends Error {
  constructor() {
    super('Redis operation exceeded its deadline');
    this.name = 'RedisTimeoutError';
  }
}

/**
 * Shared Redis access for the cache. It never makes a request wait for a connection: commands on a
 * client that is not ready fail immediately (the offline queue is disabled, see redis.module.ts),
 * and every operation has a hard deadline of `CACHE_TIMEOUT_MS`.
 *
 * node-redis stops watching its own command timeout once a command is written to the socket, so
 * the in-flight deadline lives here. A command that misses it is only abandoned by the caller: the
 * reply, if it ever comes, is discarded. That is safe because GET, SET, and DEL are idempotent, and
 * the client queue is bounded so a stalled server cannot grow memory without limit.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private errors = 0;
  private lastErrorName: string | undefined;

  private readonly timeoutMs: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly client: RedisClientLike,
    @Inject(API_CONFIG) config: Pick<ApiConfig, 'CACHE_TIMEOUT_MS'>,
  ) {
    this.timeoutMs = config.CACHE_TIMEOUT_MS;
    // Without a listener an 'error' event would crash the process. Only the error name is kept:
    // messages can carry connection details.
    this.client.on('error', (error) => {
      this.errors += 1;
      this.lastErrorName = error.name;
    });
  }

  /** Starts connecting in the background so an unavailable Redis never blocks API startup. */
  onModuleInit(): void {
    this.client.connect().catch((error: Error) => {
      this.errors += 1;
      this.lastErrorName = error.name;
    });
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  get isReady(): boolean {
    return this.client.isReady;
  }

  get errorCount(): number {
    return this.errors;
  }

  get lastError(): string | undefined {
    return this.lastErrorName;
  }

  get(key: string): Promise<string | null> {
    return this.run(() => this.client.get(key));
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.run(() => this.client.set(key, value, { EX: ttlSeconds }));
  }

  async del(key: string): Promise<void> {
    await this.run(() => this.client.del(key));
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.client.isReady) throw new RedisUnavailableError();
    const pending = operation();
    // If the deadline wins, the late settlement must not surface as an unhandled rejection.
    pending.catch(() => undefined);
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new RedisTimeoutError()), this.timeoutMs);
    });
    try {
      return await Promise.race([pending, deadline]);
    } finally {
      clearTimeout(timer);
    }
  }
}

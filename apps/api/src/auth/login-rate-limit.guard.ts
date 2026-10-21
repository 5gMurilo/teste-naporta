import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { API_CONFIG, type ApiConfig } from '../config/env.js';

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window limit per client address, kept in this process's memory (it resets on restart and
 * is not shared between instances). The window of an address starts at its first request.
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();
  private nextSweep = 0;
  private readonly windowMs: number;
  private readonly limit: number;

  constructor(@Inject(API_CONFIG) config: ApiConfig) {
    this.windowMs = config.LOGIN_RATE_TTL_SECONDS * 1000;
    this.limit = config.LOGIN_RATE_LIMIT;
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<{ ip?: string }>();
    const now = Date.now();
    this.sweep(now);

    const key = request.ip ?? 'unknown';
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }
    window.count += 1;
    if (window.count <= this.limit) return true;

    http
      .getResponse<{ setHeader(name: string, value: string): void }>()
      .setHeader('Retry-After', String(Math.max(1, Math.ceil((window.resetAt - now) / 1000))));
    throw new HttpException('Too many login attempts.', HttpStatus.TOO_MANY_REQUESTS);
  }

  /** Drops expired windows at most once per window, so memory follows the traffic of one window. */
  private sweep(now: number): void {
    if (now < this.nextSweep) return;
    this.nextSweep = now + this.windowMs;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}

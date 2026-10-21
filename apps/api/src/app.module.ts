import { DynamicModule, Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { RedisModule } from './cache/redis.module.js';
import type { ApiConfig } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { createPrismaModule } from './prisma/prisma.module.js';

@Module({ controllers: [AppController] })
export class AppModule {}

export function createAppModule(config: ApiConfig): DynamicModule {
  return {
    module: AppModule,
    imports: [createPrismaModule(config), RedisModule, AuthModule, HealthModule, OrdersModule],
  };
}

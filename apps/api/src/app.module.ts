import { DynamicModule, Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import type { ApiConfig } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { createPrismaModule } from './prisma/prisma.module.js';

@Module({ controllers: [AppController] })
export class AppModule {}

export function createAppModule(config: ApiConfig): DynamicModule {
  return {
    module: AppModule,
    imports: [createPrismaModule(config), HealthModule],
  };
}

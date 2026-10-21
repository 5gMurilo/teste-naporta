import { DynamicModule, Global, Module } from '@nestjs/common';
import { API_CONFIG, type ApiConfig } from '../config/env.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({})
export class PrismaModule {}

export function createPrismaModule(config: ApiConfig): DynamicModule {
  return {
    module: PrismaModule,
    global: true,
    providers: [{ provide: API_CONFIG, useValue: config }, PrismaService],
    exports: [API_CONFIG, PrismaService],
  };
}

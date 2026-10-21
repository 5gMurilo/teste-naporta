import { Global, Module } from '@nestjs/common';
import { API_CONFIG, loadApiConfig } from '../config/env.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [{ provide: API_CONFIG, useFactory: () => loadApiConfig() }, PrismaService],
  exports: [API_CONFIG, PrismaService],
})
export class PrismaModule {}

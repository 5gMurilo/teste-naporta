import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { createAppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/application.js';
import { RedisService } from '../../src/cache/redis.service.js';
import { loadApiConfig } from '../../src/config/env.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export interface IntegrationApp {
  app: INestApplication;
  prisma: PrismaService;
  /** Authorization header value for a freshly signed token. */
  bearer(email?: string): Promise<string>;
  /** Messages received by the failure logger. */
  logs: string[];
}

/** The real AppModule on the disposable PostgreSQL configured by the integration setup. */
export async function createIntegrationApp(
  options: { waitForRedis?: boolean } = {},
): Promise<IntegrationApp> {
  const logs: string[] = [];
  const module = await Test.createTestingModule({
    imports: [createAppModule(loadApiConfig())],
  }).compile();
  const app = module.createNestApplication();
  configureApplication(app, { error: (message) => logs.push(message) });
  await app.init();
  if (options.waitForRedis) await untilRedisReady(app.get(RedisService));
  return {
    app,
    prisma: app.get(PrismaService),
    logs,
    bearer: async (email = 'tester@example.test') =>
      `Bearer ${await app.get(JwtService).signAsync({ sub: randomUUID(), email })}`,
  };
}

async function untilRedisReady(redis: RedisService, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!redis.isReady) {
    if (Date.now() > deadline) throw new Error('Redis never became ready');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

export const validOrderBody = () => ({
  orderNumber: 'NP-2026-0001',
  expectedDeliveryDate: '2026-11-03',
  customer: { name: 'Ana Silva', document: '123.456.789-00' },
  deliveryAddress: {
    street: 'Rua das Flores',
    number: '101',
    complement: 'Apto 12',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01001000',
  },
  items: [
    { description: 'Café especial', priceCents: 4990 },
    { description: 'Caneca', priceCents: 0 },
  ],
});

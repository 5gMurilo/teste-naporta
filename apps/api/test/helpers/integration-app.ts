import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { createAppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/application.js';
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
export async function createIntegrationApp(): Promise<IntegrationApp> {
  const logs: string[] = [];
  const module = await Test.createTestingModule({
    imports: [createAppModule(loadApiConfig())],
  }).compile();
  const app = module.createNestApplication();
  configureApplication(app, { error: (message) => logs.push(message) });
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    logs,
    bearer: async (email = 'tester@example.test') =>
      `Bearer ${await app.get(JwtService).signAsync({ sub: randomUUID(), email })}`,
  };
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

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApplication } from '../../src/application.js';
import { API_CONFIG, loadApiConfig } from '../../src/config/env.js';
import { HealthController } from '../../src/health/health.controller.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

async function createHealthApp(databaseUrl?: string): Promise<INestApplication> {
  const config = loadApiConfig();
  const prisma = new PrismaService({
    ...config,
    ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
  });
  if (databaseUrl) prisma.onModuleInit = async () => undefined;
  const module = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      { provide: API_CONFIG, useValue: config },
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  const app = module.createNestApplication();
  configureApplication(app, { error: () => undefined });
  await app.init();
  return app;
}

describe('GET /api/v1/health with PostgreSQL', () => {
  it('answers 200 after a real query against the disposable database', async () => {
    const app = await createHealthApp();
    try {
      await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect({ status: 'ok', database: 'up' });
    } finally {
      await app.close();
    }
  });

  it('answers 503 problem details when the database is unreachable after startup', async () => {
    const app = await createHealthApp('postgresql://nobody:nobody@127.0.0.1:1/unreachable');
    try {
      const response = await request(app.getHttpServer()).get('/api/v1/health').expect(503);

      expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(response.body).toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE' });
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
      expect(JSON.stringify(response.body)).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|nobody/);
    } finally {
      await app.close();
    }
  });
});

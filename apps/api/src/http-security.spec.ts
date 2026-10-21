import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApplication } from './application.js';
import { loadApiConfig } from './config/env.js';
import { PrismaService } from './prisma/prisma.service.js';

const ORIGIN = 'https://app.example.test';

async function appWith(corsOrigin?: string): Promise<INestApplication> {
  jest.spyOn(PrismaService.prototype, 'onModuleInit').mockResolvedValue();
  return createApplication(
    loadApiConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost/db',
      JWT_SECRET: 'a'.repeat(32),
      JWT_ISSUER: 'naporta',
      JWT_AUDIENCE: 'naporta-web',
      JWT_EXPIRES_IN: '3600',
      REDIS_URL: 'redis://127.0.0.1:1',
      ...(corsOrigin && { CORS_ORIGIN: corsOrigin }),
    }),
  );
}

describe('HTTP security headers and CORS', () => {
  afterEach(() => jest.restoreAllMocks());

  it('adds helmet headers, including a CSP, to API responses and hides the framework', async () => {
    const app = await appWith();
    try {
      const response = await request(app.getHttpServer()).get('/').expect(401);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.headers['x-powered-by']).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('serves the documentation without a CSP (Swagger UI needs inline scripts) but keeps other headers', async () => {
    const app = await appWith();
    try {
      const json = await request(app.getHttpServer()).get('/docs-json').expect(200);
      const ui = await request(app.getHttpServer()).get('/docs').redirects(1).expect(200);

      for (const response of [json, ui]) {
        expect(response.headers['content-security-policy']).toBeUndefined();
        expect(response.headers['x-content-type-options']).toBe('nosniff');
      }
    } finally {
      await app.close();
    }
  });

  it('allows only the configured origin, with explicit methods and exposed headers', async () => {
    const app = await appWith(ORIGIN);
    try {
      const preflight = await request(app.getHttpServer())
        .options('/api/v1/orders')
        .set('Origin', ORIGIN)
        .set('Access-Control-Request-Method', 'PATCH')
        .set('Access-Control-Request-Headers', 'authorization,content-type');
      const simple = await request(app.getHttpServer()).get('/').set('Origin', ORIGIN);
      const foreign = await request(app.getHttpServer())
        .options('/api/v1/orders')
        .set('Origin', 'https://evil.example.test')
        .set('Access-Control-Request-Method', 'PATCH');

      expect(preflight.status).toBe(204);
      expect(preflight.headers['access-control-allow-origin']).toBe(ORIGIN);
      expect(preflight.headers['access-control-allow-methods']).toContain('PATCH');
      expect(preflight.headers['access-control-allow-headers']).toMatch(/Authorization/i);
      expect(simple.headers['access-control-expose-headers']).toMatch(/X-Request-Id/i);
      expect(simple.headers['access-control-expose-headers']).toMatch(/Location/i);
      expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
      expect(preflight.headers['access-control-allow-origin']).not.toBe('*');
    } finally {
      await app.close();
    }
  });

  it('sends no CORS headers at all when no origin is configured', async () => {
    const app = await appWith();
    try {
      const response = await request(app.getHttpServer())
        .options('/api/v1/orders')
        .set('Origin', ORIGIN)
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});

import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createAppModule } from '../app.module.js';
import { configureApplication } from '../application.js';
import { loadApiConfig } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

const config = loadApiConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost/db',
  JWT_SECRET: 'g'.repeat(32),
  JWT_ISSUER: 'naporta',
  JWT_AUDIENCE: 'naporta-web',
  JWT_EXPIRES_IN: '3600',
  REDIS_URL: 'redis://127.0.0.1:1',
});

describe('global JWT guard in the real AppModule', () => {
  let app: INestApplication;
  let validToken: string;

  beforeAll(async () => {
    jest.spyOn(PrismaService.prototype, 'onModuleInit').mockResolvedValue();
    const module = await Test.createTestingModule({ imports: [createAppModule(config)] })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: jest.fn(async () => [1]),
        user: { findUnique: jest.fn(async () => null) },
      })
      .compile();
    app = module.createNestApplication();
    configureApplication(app, { error: () => undefined });
    await app.init();
    validToken = await app.get(JwtService).signAsync({ sub: 'user-1', email: 'a@b.co' });
  });
  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('protects the legacy GET / route', async () => {
    const denied = await request(app.getHttpServer()).get('/').expect(401);
    await request(app.getHttpServer())
      .get('/')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200)
      .expect('Hello World!');

    expect(denied.body).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(denied.headers['content-type']).toMatch(/^application\/problem\+json/);
  });

  it('rejects tokens signed by someone else, with another audience, or expired', async () => {
    const foreign = new JwtService({ secret: 'z'.repeat(32) });
    const claims = { sub: 'user-1', email: 'a@b.co', iss: 'naporta', aud: 'naporta-web' };
    const tokens = [
      foreign.sign(claims, { expiresIn: 60 }),
      new JwtService({ secret: config.JWT_SECRET }).sign(
        { ...claims, aud: 'other' },
        { expiresIn: 60 },
      ),
      new JwtService({ secret: config.JWT_SECRET }).sign({
        ...claims,
        exp: Math.floor(Date.now() / 1000) - 5,
      }),
    ];

    for (const token of tokens) {
      await request(app.getHttpServer())
        .get('/')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    }
  });

  it('lets login and health run without a token because of @Public metadata', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@example.test', password: 'x' });
    const health = await request(app.getHttpServer()).get('/api/v1/health');

    expect(login.status).toBe(401);
    expect(login.body.code).toBe('INVALID_CREDENTIALS');
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok', database: 'up' });
  });
});

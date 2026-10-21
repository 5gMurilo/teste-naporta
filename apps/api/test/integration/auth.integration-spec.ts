import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { createAppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/application.js';
import { loadApiConfig } from '../../src/config/env.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

describe('POST /api/v1/auth/login with PostgreSQL', () => {
  let app: INestApplication;
  let userId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [createAppModule(loadApiConfig())],
    }).compile();
    app = module.createNestApplication();
    configureApplication(app, { error: () => undefined });
    await app.init();
  });
  beforeEach(async () => {
    const user = await app.get(PrismaService).user.create({
      data: { email: 'demo@example.test', passwordHash: await argon2.hash('demo-password') },
    });
    userId = user.id;
  });
  afterAll(async () => app.close());

  const login = (body: unknown) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(body as object);

  it('returns 200 with a verifiable token whose claims and lifetime match the configuration', async () => {
    const config = loadApiConfig();
    const response = await login({
      email: '  Demo@Example.TEST ',
      password: 'demo-password',
    }).expect(200);

    expect(response.body).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: config.JWT_EXPIRES_IN,
    });
    const claims = await app.get(JwtService).verifyAsync(response.body.accessToken);
    expect(claims).toMatchObject({
      sub: userId,
      email: 'demo@example.test',
      iss: config.JWT_ISSUER,
      aud: config.JWT_AUDIENCE,
    });
    expect(claims.exp - claims.iat).toBe(config.JWT_EXPIRES_IN);
    expect(JSON.stringify(response.body)).not.toMatch(/argon2|demo-password/);
  });

  it('returns identical 401 INVALID_CREDENTIALS bodies for a wrong password and an unknown email', async () => {
    const wrong = await login({ email: 'demo@example.test', password: 'nope' }).expect(401);
    const unknown = await login({ email: 'ghost@example.test', password: 'demo-password' }).expect(
      401,
    );

    const strip = ({ requestId: _id, ...rest }: Record<string, unknown>) => rest;
    expect(strip(wrong.body)).toEqual(strip(unknown.body));
    expect(wrong.body).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(wrong.headers['content-type']).toMatch(/^application\/problem\+json/);
  });

  it.each([
    ['unknown property', { email: 'demo@example.test', password: 'demo-password', admin: true }],
    ['missing password', { email: 'demo@example.test' }],
    ['empty password', { email: 'demo@example.test', password: '' }],
    ['malformed email', { email: 'demo', password: 'demo-password' }],
    ['null body values', { email: null, password: null }],
  ])('returns 400 VALIDATION_ERROR for %s without echoing input', async (_name, body) => {
    const response = await login(body).expect(400);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toContain('demo-password');
  });
});

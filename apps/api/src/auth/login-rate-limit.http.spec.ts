import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApplication } from '../application.js';
import { InvalidCredentialsError } from '../common/errors/domain-errors.js';
import { loadApiConfig } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

const credentials = { email: 'demo@example.test', password: 'wrong-password' };

async function startApp(overrides: Record<string, string> = {}) {
  jest.spyOn(PrismaService.prototype, 'onModuleInit').mockResolvedValue();
  const login = jest
    .spyOn(AuthService.prototype, 'login')
    .mockRejectedValue(new InvalidCredentialsError());
  const app = await createApplication(
    loadApiConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost/db',
      JWT_SECRET: 'r'.repeat(32),
      JWT_ISSUER: 'naporta',
      JWT_AUDIENCE: 'naporta-web',
      JWT_EXPIRES_IN: '3600',
      REDIS_URL: 'redis://127.0.0.1:1',
      ...overrides,
    }),
  );
  return { app, login };
}

const post = (app: INestApplication, forwardedFor?: string) => {
  const req = request(app.getHttpServer()).post('/api/v1/auth/login');
  return (forwardedFor ? req.set('X-Forwarded-For', forwardedFor) : req).send(credentials);
};

const statuses = async (app: INestApplication, ...forwarded: (string | undefined)[]) => {
  const result: number[] = [];
  for (const header of forwarded) result.push((await post(app, header)).status);
  return result;
};

describe('POST /api/v1/auth/login rate limit', () => {
  let app: INestApplication | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
    jest.restoreAllMocks();
  });

  it('does not call the auth service once the limit is exceeded', async () => {
    const started = await startApp({ LOGIN_RATE_LIMIT: '3' });
    app = started.app;

    expect(await statuses(app, undefined, undefined, undefined, undefined, undefined)).toEqual([
      401, 401, 401, 429, 429,
    ]);
    expect(started.login).toHaveBeenCalledTimes(3);
  });

  it('ignores X-Forwarded-For when hops is 0', async () => {
    app = (await startApp({ LOGIN_RATE_LIMIT: '2', TRUST_PROXY_HOPS: '0' })).app;

    expect(await statuses(app, '203.0.113.1', '203.0.113.2', '203.0.113.3')).toEqual([
      401, 401, 429,
    ]);
  });

  it('counts two forwarded clients in separate buckets when hops is 1', async () => {
    app = (await startApp({ LOGIN_RATE_LIMIT: '2', TRUST_PROXY_HOPS: '1' })).app;

    expect(await statuses(app, '203.0.113.1', '203.0.113.1', '203.0.113.1', '203.0.113.2')).toEqual(
      [401, 401, 429, 401],
    );
  });

  it('uses the second entry from the right when hops is 2', async () => {
    app = (await startApp({ LOGIN_RATE_LIMIT: '2', TRUST_PROXY_HOPS: '2' })).app;

    expect(
      await statuses(
        app,
        '198.51.100.1, 10.0.0.1',
        '198.51.100.1, 10.0.0.1',
        '198.51.100.1, 10.0.0.2',
        '198.51.100.9, 10.0.0.1',
      ),
    ).toEqual([401, 401, 429, 401]);
  });
});

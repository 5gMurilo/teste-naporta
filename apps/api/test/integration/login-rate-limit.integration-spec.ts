import request from 'supertest';
import { createIntegrationApp, type IntegrationApp } from '../helpers/integration-app.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const credentials = { email: 'nobody@example.test', password: 'wrong-password' };

/** Starts the real application with the given login rate variables, restoring the environment after. */
async function withRateLimit(
  variables: { LOGIN_RATE_LIMIT?: string; LOGIN_RATE_TTL_SECONDS?: string },
  run: (env: IntegrationApp) => Promise<void>,
): Promise<void> {
  const previous = {
    LOGIN_RATE_LIMIT: process.env.LOGIN_RATE_LIMIT,
    LOGIN_RATE_TTL_SECONDS: process.env.LOGIN_RATE_TTL_SECONDS,
  };
  Object.assign(process.env, variables);
  let env: IntegrationApp | undefined;
  try {
    env = await createIntegrationApp();
    await run(env);
  } finally {
    await env?.app.close();
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

const login = (env: IntegrationApp) =>
  request(env.app.getHttpServer()).post('/api/v1/auth/login').send(credentials);

describe('login rate limit with PostgreSQL', () => {
  it('answers 429 problem json with Retry-After after the limit', async () => {
    await withRateLimit({ LOGIN_RATE_LIMIT: '5' }, async (env) => {
      const first = [];
      for (let attempt = 0; attempt < 5; attempt += 1) first.push((await login(env)).status);

      const limited = await login(env);

      expect(first).toEqual([401, 401, 401, 401, 401]);
      expect(limited.status).toBe(429);
      expect(limited.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(limited.body).toMatchObject({
        status: 429,
        code: 'HTTP_ERROR',
        title: 'Too Many Requests',
      });
      expect(limited.body.requestId).toMatch(UUID);
      expect(limited.body.requestId).toBe(limited.headers['x-request-id']);
      expect(limited.headers['retry-after']).toMatch(/^[1-9]\d*$/);
      expect(Number(limited.headers['retry-after'])).toBeLessThanOrEqual(60);
    });
  });

  it('accepts logins again after the window', async () => {
    await withRateLimit({ LOGIN_RATE_LIMIT: '1', LOGIN_RATE_TTL_SECONDS: '1' }, async (env) => {
      expect((await login(env)).status).toBe(401);
      expect((await login(env)).status).toBe(429);

      const deadline = Date.now() + 5_000;
      let status = 429;
      while (status === 429 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        status = (await login(env)).status;
      }

      expect(status).toBe(401);
    });
  });

  it('does not throttle health or the orders routes', async () => {
    await withRateLimit({ LOGIN_RATE_LIMIT: '2' }, async (env) => {
      const auth = await env.bearer();
      const health: number[] = [];
      const orders: number[] = [];
      for (let attempt = 0; attempt < 20; attempt += 1) {
        health.push((await request(env.app.getHttpServer()).get('/api/v1/health')).status);
        orders.push(
          (await request(env.app.getHttpServer()).get('/api/v1/orders').set('Authorization', auth))
            .status,
        );
      }

      expect(health).toEqual(Array(20).fill(200));
      expect(orders).toEqual(Array(20).fill(200));
    });
  });
});

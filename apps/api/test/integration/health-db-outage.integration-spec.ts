import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import { createIntegrationApp, type IntegrationApp } from '../helpers/integration-app.js';
import { waitForPort } from '../helpers/wait-for-port.js';

describe('GET /api/v1/health when the database stops', () => {
  let database: StartedPostgreSqlContainer | undefined;
  let env: IntegrationApp | undefined;
  const originalUrl = process.env.DATABASE_URL;

  afterAll(async () => {
    await env?.app.close();
    await database?.stop().catch(() => undefined);
    process.env.DATABASE_URL = originalUrl;
  });

  it('answers 503 after the database stops following a successful start', async () => {
    database = await new PostgreSqlContainer('postgres:17-alpine')
      .withStartupTimeout(120_000)
      .start();
    await waitForPort(database.getConnectionUri());
    process.env.DATABASE_URL = database.getConnectionUri();
    env = await createIntegrationApp();
    const health = () => request(env?.app.getHttpServer()).get('/api/v1/health');

    const up = await health();
    await database.stop();
    const down = await health();

    expect(up.status).toBe(200);
    expect(down.status).toBe(503);
    expect(down.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(down.body).toMatchObject({ status: 503, code: 'SERVICE_UNAVAILABLE' });
  });
});

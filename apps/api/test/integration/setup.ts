import { jest } from '@jest/globals';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

jest.setTimeout(180_000);

let container: StartedPostgreSqlContainer | undefined;
const configKeys = [
  'NODE_ENV',
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_ISSUER',
  'JWT_AUDIENCE',
  'JWT_EXPIRES_IN',
  'REDIS_URL',
  'CACHE_TTL_SECONDS',
  'CACHE_TIMEOUT_MS',
] as const;
const previousConfig = Object.fromEntries(configKeys.map((key) => [key, process.env[key]]));

function restoreConfig() {
  for (const key of configKeys) {
    const previous = previousConfig[key];
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
}

beforeAll(async () => {
  try {
    container = await new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('teste_naporta_test')
      .withUsername('postgres')
      .withPassword('postgres')
      .withStartupTimeout(120_000)
      .start();
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'integration-test-secret-with-32-chars';
    process.env.JWT_ISSUER = 'naporta-test';
    process.env.JWT_AUDIENCE = 'naporta-test-client';
    process.env.JWT_EXPIRES_IN = '3600';
    process.env.REDIS_URL = 'redis://localhost:6379';
    delete process.env.CACHE_TTL_SECONDS;
    delete process.env.CACHE_TIMEOUT_MS;
  } catch (error) {
    try {
      await container?.stop();
    } finally {
      restoreConfig();
    }
    throw error;
  }
});

afterAll(async () => {
  try {
    await container?.stop();
  } finally {
    restoreConfig();
  }
});

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';

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

type PostgresContainer = Pick<StartedPostgreSqlContainer, 'getConnectionUri' | 'stop'>;

interface PostgresTestContextOptions {
  environment?: NodeJS.ProcessEnv;
  startContainer?: () => Promise<PostgresContainer>;
  migrate?: (databaseUrl: string, environment: NodeJS.ProcessEnv) => void;
  resetDatabase?: (databaseUrl: string) => Promise<void>;
}

export interface PostgresTestContext {
  readonly databaseUrl: string;
  reset(): Promise<void>;
  close(): Promise<void>;
}

async function resetPostgres(databaseUrl: string): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('TRUNCATE TABLE "OrderItem", "Order", "User" RESTART IDENTITY CASCADE');
  } finally {
    await client.end();
  }
}

function applyMigrations(environment: NodeJS.ProcessEnv): void {
  const apiDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiDirectory,
    env: environment,
    stdio: 'inherit',
  });
}

export async function createPostgresTestContext(
  options: PostgresTestContextOptions = {},
): Promise<PostgresTestContext> {
  const environment = options.environment ?? process.env;
  const previousConfig = Object.fromEntries(configKeys.map((key) => [key, environment[key]]));
  let container: PostgresContainer | undefined;
  let closed = false;

  const restoreConfig = () => {
    for (const key of configKeys) {
      const previous = previousConfig[key];
      if (previous === undefined) delete environment[key];
      else environment[key] = previous;
    }
  };

  try {
    container = await (
      options.startContainer ??
      (() =>
        new PostgreSqlContainer('postgres:17-alpine')
          .withDatabase('teste_naporta_test')
          .withUsername('postgres')
          .withPassword('postgres')
          .withStartupTimeout(120_000)
          .start())
    )();

    const databaseUrl = container.getConnectionUri();
    environment.DATABASE_URL = databaseUrl;
    environment.NODE_ENV = 'test';
    environment.JWT_SECRET = 'integration-test-secret-with-32-chars';
    environment.JWT_ISSUER = 'naporta-test';
    environment.JWT_AUDIENCE = 'naporta-test-client';
    environment.JWT_EXPIRES_IN = '3600';
    environment.REDIS_URL = 'redis://localhost:6379';
    delete environment.CACHE_TTL_SECONDS;
    delete environment.CACHE_TIMEOUT_MS;

    (options.migrate ?? ((_databaseUrl, env) => applyMigrations(env)))(databaseUrl, environment);

    return {
      databaseUrl,
      reset: () => (options.resetDatabase ?? resetPostgres)(databaseUrl),
      close: async () => {
        if (closed) return;
        closed = true;
        try {
          await container?.stop();
        } finally {
          restoreConfig();
        }
      },
    };
  } catch (error) {
    try {
      await container?.stop();
    } finally {
      restoreConfig();
    }
    throw error;
  }
}

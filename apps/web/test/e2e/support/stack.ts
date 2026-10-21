/**
 * Lifecycle of the disposable stack used by the browser tests: PostgreSQL, Redis, the compiled API,
 * and the built SPA behind `vite preview`. Every step registers its own cleanup the moment it
 * succeeds, so a failure halfway through releases exactly what was acquired, in reverse order.
 */

export interface Service {
  stop(): Promise<void>;
}

export interface StackSteps {
  freePort(): Promise<number>;
  startPostgres(): Promise<Service & { databaseUrl: string }>;
  startRedis(): Promise<Service & { redisUrl: string }>;
  migrateAndSeed(input: { databaseUrl: string; seed: SeedCredentials }): Promise<void>;
  startApi(input: { port: number; env: Record<string, string> }): Promise<Service>;
  startWeb(input: { port: number; apiUrl: string }): Promise<Service>;
  waitForHttp(url: string, label: string): Promise<void>;
  secret(): string;
}

export interface SeedCredentials {
  email: string;
  password: string;
}

export interface Stack {
  apiUrl: string;
  webUrl: string;
  databaseUrl: string;
  redisUrl: string;
  seed: SeedCredentials;
  stop(): Promise<void>;
}

export async function startStack(steps: StackSteps): Promise<Stack> {
  const cleanups: (() => Promise<void>)[] = [];
  const stopAll = async () => {
    const failures: unknown[] = [];
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        await cleanup();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0)
      throw new AggregateError(failures, 'Failed to stop the E2E stack cleanly');
  };

  try {
    const postgres = await steps.startPostgres();
    cleanups.push(() => postgres.stop());
    const redis = await steps.startRedis();
    cleanups.push(() => redis.stop());

    const seed: SeedCredentials = { email: 'demo@example.test', password: steps.secret() };
    await steps.migrateAndSeed({ databaseUrl: postgres.databaseUrl, seed });

    const [apiPort, webPort] = [await steps.freePort(), await steps.freePort()];
    const apiUrl = `http://127.0.0.1:${apiPort}`;
    const webUrl = `http://127.0.0.1:${webPort}`;

    const api = await steps.startApi({
      port: apiPort,
      env: {
        NODE_ENV: 'production',
        PORT: String(apiPort),
        DATABASE_URL: postgres.databaseUrl,
        REDIS_URL: redis.redisUrl,
        JWT_SECRET: steps.secret(),
        JWT_ISSUER: 'naporta-e2e',
        JWT_AUDIENCE: 'naporta-e2e-web',
        JWT_EXPIRES_IN: '3600',
        // Every test logs in; the login limit itself is proven by the API suites.
        LOGIN_RATE_LIMIT: '1000',
      },
    });
    cleanups.push(() => api.stop());
    await steps.waitForHttp(`${apiUrl}/api/v1/health`, 'API');

    const web = await steps.startWeb({ port: webPort, apiUrl });
    cleanups.push(() => web.stop());
    await steps.waitForHttp(`${webUrl}/`, 'web');

    return {
      apiUrl,
      webUrl,
      databaseUrl: postgres.databaseUrl,
      redisUrl: redis.redisUrl,
      seed,
      stop: stopAll,
    };
  } catch (error) {
    await stopAll().catch(() => undefined);
    throw error;
  }
}

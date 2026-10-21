import pg from 'pg';
import { createClient } from 'redis';

export function stackEnv() {
  const read = (name: string) => {
    const value = process.env[name];
    if (!value)
      throw new Error(`${name} is not set: the E2E stack was not started by global setup`);
    return value;
  };
  return {
    apiUrl: read('E2E_API_URL'),
    webUrl: read('E2E_WEB_URL'),
    databaseUrl: read('E2E_DATABASE_URL'),
    redisUrl: read('E2E_REDIS_URL'),
    seed: { email: read('E2E_SEED_EMAIL'), password: read('E2E_SEED_PASSWORD') },
  };
}

export async function withDatabase<T>(use: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: stackEnv().databaseUrl });
  await client.connect();
  try {
    return await use(client);
  } finally {
    await client.end();
  }
}

async function openRedis() {
  const client = createClient({ url: stackEnv().redisUrl });
  client.on('error', () => undefined);
  await client.connect();
  return client;
}

type RedisConnection = Awaited<ReturnType<typeof openRedis>>;

export async function withRedis<T>(use: (client: RedisConnection) => Promise<T>): Promise<T> {
  const client = await openRedis();
  try {
    return await use(client);
  } finally {
    client.destroy();
  }
}

/**
 * Brings the data back to a known state between tests: no orders, no cache entries. The seeded
 * demo user is kept so login keeps working. Only touches the disposable instances of this run.
 */
export async function resetData(): Promise<void> {
  await withDatabase((client) => client.query('TRUNCATE TABLE "OrderItem", "Order" CASCADE'));
  await withRedis(async (redis) => {
    for await (const keys of redis.scanIterator({ MATCH: 'naporta:*', COUNT: 100 })) {
      if (keys.length > 0) await redis.unlink(keys);
    }
  });
}

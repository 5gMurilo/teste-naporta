import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { createClient } from 'redis';
import { waitForPort } from './wait-for-port.js';

export const CACHE_NAMESPACE = 'naporta:';

type RedisContainerLike = Pick<StartedRedisContainer, 'getConnectionUrl' | 'stop'>;

interface RedisTestContextOptions {
  environment?: NodeJS.ProcessEnv;
  startContainer?: () => Promise<RedisContainerLike>;
  resetNamespace?: (redisUrl: string) => Promise<void>;
}

export interface RedisTestContext {
  readonly redisUrl: string;
  /** Deletes only the application namespace; the instance is exclusive to this context anyway. */
  reset(): Promise<void>;
  close(): Promise<void>;
}

async function deleteNamespace(redisUrl: string): Promise<void> {
  const client = createClient({ url: redisUrl });
  client.on('error', () => undefined);
  await client.connect();
  try {
    for await (const keys of client.scanIterator({ MATCH: `${CACHE_NAMESPACE}*`, COUNT: 100 })) {
      if (keys.length > 0) await client.unlink(keys);
    }
  } finally {
    client.destroy();
  }
}

/**
 * A disposable Redis for one suite. REDIS_URL is pointed at it and restored when the context is
 * closed or when startup fails halfway, so no run ever reads or flushes a Redis of the developer.
 */
export async function createRedisTestContext(
  options: RedisTestContextOptions = {},
): Promise<RedisTestContext> {
  const environment = options.environment ?? process.env;
  const previousUrl = environment.REDIS_URL;
  let container: RedisContainerLike | undefined;
  let closed = false;

  const restore = () => {
    if (previousUrl === undefined) delete environment.REDIS_URL;
    else environment.REDIS_URL = previousUrl;
  };

  try {
    container = await (
      options.startContainer ?? (() => new RedisContainer('redis:7-alpine').start())
    )();
    const redisUrl = container.getConnectionUrl();
    if (!options.startContainer) await waitForPort(redisUrl);
    environment.REDIS_URL = redisUrl;
    return {
      redisUrl,
      reset: () => (options.resetNamespace ?? deleteNamespace)(redisUrl),
      close: async () => {
        if (closed) return;
        closed = true;
        try {
          await container?.stop();
        } finally {
          restore();
        }
      },
    };
  } catch (error) {
    try {
      await container?.stop();
    } finally {
      restore();
    }
    throw error;
  }
}

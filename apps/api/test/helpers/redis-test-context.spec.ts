import { jest } from '@jest/globals';
import { createRedisTestContext } from './redis-test-context.js';

const fakeContainer = () => ({
  getConnectionUrl: () => 'redis://127.0.0.1:55555',
  stop: jest.fn(async () => undefined as never),
});

describe('createRedisTestContext (I32 partial)', () => {
  it('points REDIS_URL at the disposable instance and restores it on close, once', async () => {
    const environment: NodeJS.ProcessEnv = { REDIS_URL: 'redis://developer-machine:6379' };
    const container = fakeContainer();
    const context = await createRedisTestContext({
      environment,
      startContainer: async () => container,
    });

    expect(environment.REDIS_URL).toBe('redis://127.0.0.1:55555');
    await context.close();
    await context.close();

    expect(environment.REDIS_URL).toBe('redis://developer-machine:6379');
    expect(container.stop).toHaveBeenCalledTimes(1);
  });

  it('removes REDIS_URL when none existed before', async () => {
    const environment: NodeJS.ProcessEnv = {};
    const context = await createRedisTestContext({
      environment,
      startContainer: async () => fakeContainer(),
    });

    await context.close();

    expect('REDIS_URL' in environment).toBe(false);
  });

  it('resets only through the namespace deleter bound to its own URL', async () => {
    const resetNamespace = jest.fn(async (_url: string) => undefined);
    const context = await createRedisTestContext({
      environment: {},
      startContainer: async () => fakeContainer(),
      resetNamespace,
    });

    await context.reset();

    expect(resetNamespace).toHaveBeenCalledWith('redis://127.0.0.1:55555');
    await context.close();
  });

  it('restores the environment and stops nothing extra when the container fails to start', async () => {
    const environment: NodeJS.ProcessEnv = { REDIS_URL: 'redis://developer-machine:6379' };

    await expect(
      createRedisTestContext({
        environment,
        startContainer: async () => Promise.reject(new Error('Docker unavailable')),
      }),
    ).rejects.toThrow('Docker unavailable');

    expect(environment.REDIS_URL).toBe('redis://developer-machine:6379');
  });
});

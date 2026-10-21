import { jest } from '@jest/globals';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createPostgresTestContext } from './postgres-test-context.js';

const uri = 'postgresql://postgres:test@127.0.0.1:32789/test';

function fakeContainer() {
  return {
    getConnectionUri: () => uri,
    stop: jest.fn(async () => undefined),
  } as unknown as StartedPostgreSqlContainer;
}

describe('createPostgresTestContext', () => {
  it('uses the disposable database when DATABASE_URL is absent', async () => {
    const environment: NodeJS.ProcessEnv = {};
    const migrate = jest.fn((_databaseUrl: string, _environment: NodeJS.ProcessEnv) => undefined);
    const context = await createPostgresTestContext({
      environment,
      startContainer: async () => fakeContainer(),
      migrate,
    });

    expect(environment.DATABASE_URL).toBe(uri);
    expect(migrate).toHaveBeenCalledWith(uri, environment);
    await context.close();
    expect(environment.DATABASE_URL).toBeUndefined();
  });

  it('overrides an external URL during tests and restores it afterward', async () => {
    const environment: NodeJS.ProcessEnv = { DATABASE_URL: 'postgresql://external/sentinel' };
    const migrate = jest.fn((_databaseUrl: string, _environment: NodeJS.ProcessEnv) => undefined);
    const context = await createPostgresTestContext({
      environment,
      startContainer: async () => fakeContainer(),
      migrate,
    });

    expect(migrate).toHaveBeenCalledWith(uri, environment);
    expect(environment.DATABASE_URL).toBe(uri);
    await context.close();
    expect(environment.DATABASE_URL).toBe('postgresql://external/sentinel');
  });

  it('resets data through the isolated container URL', async () => {
    const resetDatabase = jest.fn(async (_databaseUrl: string) => undefined);
    const context = await createPostgresTestContext({
      environment: {},
      startContainer: async () => fakeContainer(),
      migrate: () => undefined,
      resetDatabase,
    });

    await context.reset();
    expect(resetDatabase).toHaveBeenCalledWith(uri);
    await context.close();
  });

  it('stops a partially initialized container and restores config when migration fails', async () => {
    const environment: NodeJS.ProcessEnv = { DATABASE_URL: 'postgresql://external/sentinel' };
    const container = fakeContainer();
    const failure = new Error('migration failed');

    await expect(
      createPostgresTestContext({
        environment,
        startContainer: async () => container,
        migrate: () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);

    expect(container.stop).toHaveBeenCalledTimes(1);
    expect(environment.DATABASE_URL).toBe('postgresql://external/sentinel');
  });

  it('fails without a Docker runtime and does not migrate an external database', async () => {
    const environment: NodeJS.ProcessEnv = { DATABASE_URL: 'postgresql://external/sentinel' };
    const failure = new Error('Could not find a working container runtime strategy');
    const migrate = jest.fn((_databaseUrl: string, _environment: NodeJS.ProcessEnv) => undefined);

    await expect(
      createPostgresTestContext({
        environment,
        startContainer: async () => {
          throw failure;
        },
        migrate,
      }),
    ).rejects.toBe(failure);

    expect(migrate).not.toHaveBeenCalled();
    expect(environment.DATABASE_URL).toBe('postgresql://external/sentinel');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { type Service, type StackSteps, startStack } from '../e2e/support/stack';

function service(events: string[], name: string, stopFails = false): Service {
  return {
    stop: vi.fn(async () => {
      events.push(`stop ${name}`);
      if (stopFails) throw new Error(`${name} failed to stop`);
    }),
  };
}

function createSteps(events: string[], failAt?: keyof StackSteps): StackSteps {
  const guard = (step: keyof StackSteps) => {
    events.push(`start ${step}`);
    if (step === failAt) throw new Error(`${step} failed`);
  };
  let ports = 4000;
  return {
    freePort: async () => ++ports,
    secret: () => 'secret-value',
    startPostgres: async () => {
      guard('startPostgres');
      return { databaseUrl: 'postgresql://db', ...service(events, 'postgres') };
    },
    startRedis: async () => {
      guard('startRedis');
      return { redisUrl: 'redis://cache', ...service(events, 'redis') };
    },
    migrateAndSeed: async () => guard('migrateAndSeed'),
    startApi: async () => {
      guard('startApi');
      return service(events, 'api');
    },
    startWeb: async () => {
      guard('startWeb');
      return service(events, 'web');
    },
    waitForHttp: async (url) => {
      guard('waitForHttp');
      events.push(`ready ${url}`);
    },
  };
}

describe('startStack (E2E harness lifecycle)', () => {
  it('starts services in dependency order with exclusive ports and stops them in reverse', async () => {
    const events: string[] = [];

    const stack = await startStack(createSteps(events));

    expect(stack.apiUrl).toBe('http://127.0.0.1:4001');
    expect(stack.webUrl).toBe('http://127.0.0.1:4002');
    expect(stack.databaseUrl).toBe('postgresql://db');
    expect(stack.redisUrl).toBe('redis://cache');
    expect(stack.seed).toEqual({ email: 'demo@example.test', password: 'secret-value' });
    expect(events.filter((e) => e.startsWith('start ') && e !== 'start waitForHttp')).toEqual([
      'start startPostgres',
      'start startRedis',
      'start migrateAndSeed',
      'start startApi',
      'start startWeb',
    ]);
    events.length = 0;
    await stack.stop();
    expect(events).toEqual(['stop web', 'stop api', 'stop redis', 'stop postgres']);
  });

  it('waits for the API health and the web root before declaring the stack ready', async () => {
    const events: string[] = [];

    await startStack(createSteps(events));

    expect(events).toContain('ready http://127.0.0.1:4001/api/v1/health');
    expect(events).toContain('ready http://127.0.0.1:4002/');
    expect(events.indexOf('ready http://127.0.0.1:4001/api/v1/health')).toBeLessThan(
      events.indexOf('start startWeb'),
    );
  });

  it.each([
    ['startRedis', ['stop postgres']],
    ['migrateAndSeed', ['stop redis', 'stop postgres']],
    ['startApi', ['stop redis', 'stop postgres']],
    ['startWeb', ['stop api', 'stop redis', 'stop postgres']],
  ] as const)(
    'releases exactly what was acquired when %s fails',
    async (failing, expectedStops) => {
      const events: string[] = [];

      await expect(startStack(createSteps(events, failing))).rejects.toThrow(`${failing} failed`);

      expect(events.filter((e) => e.startsWith('stop '))).toEqual(expectedStops);
    },
  );

  it('releases everything when the API never becomes ready', async () => {
    const events: string[] = [];
    const steps = createSteps(events);
    steps.waitForHttp = async () => {
      throw new Error('API did not become ready');
    };

    await expect(startStack(steps)).rejects.toThrow('API did not become ready');

    expect(events.filter((e) => e.startsWith('stop '))).toEqual([
      'stop api',
      'stop redis',
      'stop postgres',
    ]);
  });

  it('keeps stopping the remaining services when one stop fails, and reports it', async () => {
    const events: string[] = [];
    const steps = createSteps(events);
    steps.startApi = async () => service(events, 'api', true);
    const stack = await startStack(steps);

    await expect(stack.stop()).rejects.toThrow('Failed to stop the E2E stack cleanly');

    expect(events.filter((e) => e.startsWith('stop '))).toEqual([
      'stop web',
      'stop api',
      'stop redis',
      'stop postgres',
    ]);
  });
});

import { jest } from '@jest/globals';
import { createApplication, jsonErrorLogger } from './application.js';
import { API_CONFIG, loadApiConfig } from './config/env.js';
import { PrismaService } from './prisma/prisma.service.js';

const config = () =>
  loadApiConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost/db',
    JWT_SECRET: 'a'.repeat(32),
    JWT_ISSUER: 'naporta',
    JWT_AUDIENCE: 'naporta-web',
    JWT_EXPIRES_IN: '3600',
    REDIS_URL: 'redis://127.0.0.1:1',
  });

describe('createApplication', () => {
  afterEach(() => jest.restoreAllMocks());

  it('initializes HTTP providers without opening a listener and injects the supplied config', async () => {
    const init = jest.spyOn(PrismaService.prototype, 'onModuleInit').mockResolvedValue();
    const app = await createApplication(config());

    expect(app.get(API_CONFIG)).toMatchObject({ PORT: 3000, JWT_ISSUER: 'naporta' });
    expect(app.getHttpServer().listening).toBe(false);
    expect(init).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('runs Prisma shutdown hooks when the application closes', async () => {
    jest.spyOn(PrismaService.prototype, 'onModuleInit').mockResolvedValue();
    const destroy = jest.spyOn(PrismaService.prototype, 'onModuleDestroy').mockResolvedValue();
    const app = await createApplication(config());

    await app.close();

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('does not initialize providers in documentation mode', async () => {
    const init = jest.spyOn(PrismaService.prototype, 'onModuleInit').mockResolvedValue();
    const app = await createApplication(config(), 'docs');

    expect(init).not.toHaveBeenCalled();
    await app.close();
  });

  it('replaces bootstrap errors with a safe message', async () => {
    jest
      .spyOn(PrismaService.prototype, 'onModuleInit')
      .mockRejectedValue(new Error('database-password-sentinel'));

    const error = await createApplication(config()).then(
      () => new Error('Expected application initialization to fail'),
      (failure: unknown) => failure,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Unable to initialize API application');
    expect((error as Error).message).not.toContain('database-password-sentinel');
  });

  it('writes failure logs as one plain JSON object per line on stderr, without colour codes', () => {
    const write = jest.spyOn(process.stderr, 'write').mockReturnValue(true);

    jsonErrorLogger.error(JSON.stringify({ event: 'request_failed', status: 500 }));

    const line = String(write.mock.calls[0]?.[0]);
    expect(line.endsWith('\n')).toBe(true);
    expect(line).not.toContain('\u001b[');
    expect(JSON.parse(line)).toEqual({ event: 'request_failed', status: 500 });
  });
});

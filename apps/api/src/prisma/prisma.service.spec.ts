import { jest } from '@jest/globals';
import { loadApiConfig } from '../config/env.js';
import { PrismaService } from './prisma.service.js';

jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class {
    $connect = jest.fn();
    $disconnect = jest.fn();
  },
}));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: class {} }));

describe('PrismaService', () => {
  it('connects once on module initialization', async () => {
    const service = new PrismaService(
      loadApiConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://localhost/db',
        JWT_SECRET: 'a'.repeat(32),
        JWT_ISSUER: 'naporta',
        JWT_AUDIENCE: 'naporta-web',
        JWT_EXPIRES_IN: '3600',
        REDIS_URL: 'redis://127.0.0.1:1',
      }),
    );
    const connect = jest.spyOn(service, '$connect');
    await service.onModuleInit();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('propagates a failed database connection during module initialization', async () => {
    const service = new PrismaService(
      loadApiConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://localhost/db',
        JWT_SECRET: 'a'.repeat(32),
        JWT_ISSUER: 'naporta',
        JWT_AUDIENCE: 'naporta-web',
        JWT_EXPIRES_IN: '3600',
        REDIS_URL: 'redis://127.0.0.1:1',
      }),
    );
    const failure = new Error('database unavailable');
    jest.spyOn(service, '$connect').mockRejectedValue(failure);

    await expect(service.onModuleInit()).rejects.toBe(failure);
  });

  it('disconnects once on module shutdown', async () => {
    const service = new PrismaService(
      loadApiConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://localhost/db',
        JWT_SECRET: 'a'.repeat(32),
        JWT_ISSUER: 'naporta',
        JWT_AUDIENCE: 'naporta-web',
        JWT_EXPIRES_IN: '3600',
        REDIS_URL: 'redis://127.0.0.1:1',
      }),
    );
    const disconnect = jest.spyOn(service, '$disconnect');
    await service.onModuleDestroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

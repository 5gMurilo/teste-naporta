import type { ServerResponse } from 'node:http';
import { jest } from '@jest/globals';
import request from 'supertest';
import { createApplication } from '../../application.js';
import { loadApiConfig } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  getRequestId,
  REQUEST_ID_HEADER,
  type RequestWithId,
  requestIdMiddleware,
} from './request-id.middleware.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function run(headers: Record<string, string> = {}) {
  const req = { headers } as RequestWithId;
  const setHeader = jest.fn();
  const next = jest.fn();
  requestIdMiddleware(req, { setHeader } as unknown as ServerResponse, next);
  return { req, setHeader, next };
}

describe('requestIdMiddleware', () => {
  it('generates a UUID, exposes it as X-Request-Id, and stores the same value in the request context', () => {
    const { req, setHeader, next } = run();

    const id = getRequestId(req);
    expect(id).toMatch(UUID);
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, id);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ignores a hostile incoming request id and does not echo any request header', () => {
    const hostile = 'attacker\r\nSet-Cookie: x=1';
    const { req, setHeader } = run({
      'x-request-id': hostile,
      authorization: 'Bearer secret-token-sentinel',
    });

    expect(getRequestId(req)).not.toBe(hostile);
    expect(getRequestId(req)).toMatch(UUID);
    expect(setHeader).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(setHeader.mock.calls)).not.toContain('secret-token-sentinel');
    expect(JSON.stringify(setHeader.mock.calls)).not.toContain('attacker');
  });

  it('issues a different id for every request', () => {
    expect(getRequestId(run().req)).not.toBe(getRequestId(run().req));
  });
});

describe('request id over HTTP', () => {
  afterEach(() => jest.restoreAllMocks());

  it('adds a fresh X-Request-Id to success, not-found, and malformed JSON responses', async () => {
    jest.spyOn(PrismaService.prototype, 'onModuleInit').mockResolvedValue();
    const app = await createApplication(
      loadApiConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://localhost/db',
        JWT_SECRET: 'a'.repeat(32),
        JWT_ISSUER: 'naporta',
        JWT_AUDIENCE: 'naporta-web',
        JWT_EXPIRES_IN: '3600',
        REDIS_URL: 'redis://localhost:6379',
      }),
    );
    try {
      const server = app.getHttpServer();
      const ok = await request(server).get('/').set('X-Request-Id', 'client-chosen').expect(200);
      const missing = await request(server).get('/missing').expect(404);
      const malformed = await request(server)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('{"broken"')
        .expect(400);

      const ids = [ok, missing, malformed].map((response) => response.headers['x-request-id']);
      for (const id of ids) expect(id).toMatch(UUID);
      expect(new Set(ids).size).toBe(3);
      expect(ids).not.toContain('client-chosen');
    } finally {
      await app.close();
    }
  });
});

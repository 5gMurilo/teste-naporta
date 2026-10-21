import { jest } from '@jest/globals';
import { type INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApplication } from '../application.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

const SWAGGER_API_RESPONSE = 'swagger/apiResponse';

function createController(queryRaw: jest.Mock<() => Promise<unknown>>) {
  return new HealthController({ $queryRaw: queryRaw } as unknown as PrismaService);
}

describe('HealthController', () => {
  it('returns exactly status ok and database up after a real query call', async () => {
    const queryRaw = jest.fn(async () => [{ '?column?': 1 }]);

    await expect(createController(queryRaw).check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('turns a driver failure into a 503 exception without driver details', async () => {
    const queryRaw = jest.fn(async () =>
      Promise.reject(new Error('connect ECONNREFUSED 10.0.0.1')),
    );

    const error = await createController(queryRaw)
      .check()
      .catch((failure: unknown) => failure);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toContain(
      'ECONNREFUSED',
    );
  });

  it('documents the 200 example and the problem+json 503 response', () => {
    const responses = Reflect.getMetadata(SWAGGER_API_RESPONSE, HealthController.prototype.check);

    expect(responses['200'].example).toEqual({ status: 'ok', database: 'up' });
    expect(responses['503'].content['application/problem+json'].example).toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });
});

describe('GET /api/v1/health envelope', () => {
  let app: INestApplication;
  const queryRaw = jest.fn<() => Promise<unknown>>();
  const logger = { error: jest.fn<(message: string) => void>() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
    }).compile();
    app = module.createNestApplication();
    configureApplication(app, logger);
    await app.init();
  });
  afterAll(async () => app.close());

  it('serves the 200 body and a problem+json 503 with request id and no driver text', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const up = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    queryRaw.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.1:5432'));
    const down = await request(app.getHttpServer()).get('/api/v1/health').expect(503);

    expect(up.body).toEqual({ status: 'ok', database: 'up' });
    expect(down.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(down.body).toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      instance: '/api/v1/health',
      requestId: down.headers['x-request-id'],
    });
    expect(JSON.stringify(down.body)).not.toMatch(/ECONNREFUSED|5432/);
  });
});
